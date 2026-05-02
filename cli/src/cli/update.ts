import chalk from 'chalk'
import { getAPIProvider } from 'src/utils/model/providers.js'
import { logEvent } from 'src/services/analytics/index.js'
import {
  getLatestVersion,
  type InstallStatus,
  installGlobalPackage,
} from 'src/utils/autoUpdater.js'
import { performGithubUpdate } from 'src/utils/githubReleaseUpdater.js'
import { regenerateCompletionCache } from 'src/utils/completionCache.js'
import {
  getGlobalConfig,
  type InstallMethod,
  saveGlobalConfig,
} from 'src/utils/config.js'
import { logForDebugging } from 'src/utils/debug.js'
import { getDoctorDiagnostic } from 'src/utils/doctorDiagnostic.js'
import { gracefulShutdown } from 'src/utils/gracefulShutdown.js'
import {
  installOrUpdateClaudePackage,
  localInstallationExists,
} from 'src/utils/localInstaller.js'
import {
  installLatest as installLatestNative,
  removeInstalledSymlink,
} from 'src/utils/nativeInstaller/index.js'
import { getPackageManager } from 'src/utils/nativeInstaller/packageManagers.js'
import { writeToStdout } from 'src/utils/process.js'
import { gte } from 'src/utils/semver.js'
import { getInitialSettings } from 'src/utils/settings/settings.js'

export async function update() {
  // Altaris CLI GitHub Releases (argusteknoloji/altaris-super-agent-releases)
  // üzerinden Bun-compiled standalone binary olarak dağıtılır. npm registry
  // veya 3rd-party provider kontrolü yapmıyoruz — single distribution channel.

  logEvent('tengu_update_check', {})
  writeToStdout(`Current version: ${MACRO.DISPLAY_VERSION}\n`)

  const channel = getInitialSettings()?.autoUpdatesChannel ?? 'latest'
  writeToStdout(`Checking for updates to ${channel} version...\n`)

  logForDebugging('update: Starting update check')

  // Run diagnostic to detect potential issues
  logForDebugging('update: Running diagnostic')
  const diagnostic = await getDoctorDiagnostic()
  logForDebugging(`update: Installation type: ${diagnostic.installationType}`)
  logForDebugging(
    `update: Config install method: ${diagnostic.configInstallMethod}`,
  )

  // Check for multiple installations
  if (diagnostic.multipleInstallations.length > 1) {
    writeToStdout('\n')
    writeToStdout(chalk.yellow('Warning: Multiple installations found') + '\n')
    for (const install of diagnostic.multipleInstallations) {
      const current =
        diagnostic.installationType === install.type
          ? ' (currently running)'
          : ''
      writeToStdout(`- ${install.type} at ${install.path}${current}\n`)
    }
  }

  // Display warnings if any exist
  if (diagnostic.warnings.length > 0) {
    writeToStdout('\n')
    for (const warning of diagnostic.warnings) {
      logForDebugging(`update: Warning detected: ${warning.issue}`)

      // Don't skip PATH warnings - they're always relevant
      // The user needs to know that 'which altaris' points elsewhere
      logForDebugging(`update: Showing warning: ${warning.issue}`)

      writeToStdout(chalk.yellow(`Warning: ${warning.issue}\n`))

      writeToStdout(chalk.bold(`Fix: ${warning.fix}\n`))
    }
  }

  // Update config if installMethod is not set (but skip for package managers)
  const config = getGlobalConfig()
  if (
    !config.installMethod &&
    diagnostic.installationType !== 'package-manager'
  ) {
    writeToStdout('\n')
    writeToStdout('Updating configuration to track installation method...\n')
    let detectedMethod: 'local' | 'native' | 'global' | 'unknown' = 'unknown'

    // Map diagnostic installation type to config install method
    switch (diagnostic.installationType) {
      case 'npm-local':
        detectedMethod = 'local'
        break
      case 'native':
        detectedMethod = 'native'
        break
      case 'npm-global':
        detectedMethod = 'global'
        break
      default:
        detectedMethod = 'unknown'
    }

    saveGlobalConfig(current => ({
      ...current,
      installMethod: detectedMethod,
    }))
    writeToStdout(`Installation method set to: ${detectedMethod}\n`)
  }

  // Development build (örneğin `bun run dev` ile çalışıyorsa) — bu durumda
  // process.execPath bun interpreter'ını gösterir, kendisini değiştiremeyiz.
  if (diagnostic.installationType === 'development') {
    writeToStdout('\n')
    writeToStdout(
      chalk.yellow('Development build — kaynaktan çalıştırılıyor.') + '\n',
    )
    writeToStdout('Geliştirici güncellemesi için:\n')
    writeToStdout(chalk.bold('  git pull && bun install && bun run build') + '\n')
    writeToStdout('\n')
    writeToStdout('Production binary kurmak için:\n')
    writeToStdout(chalk.bold(
      '  curl -L https://github.com/argusteknoloji/altaris-super-agent-releases/releases/latest/download/altaris-' +
      (process.platform === 'darwin' ? 'darwin' : process.platform === 'win32' ? 'windows' : 'linux') +
      '-' + (process.arch === 'arm64' ? 'arm64' : 'x64') +
      (process.platform === 'win32' ? '.exe' : '') +
      ' -o /usr/local/bin/altaris && chmod +x /usr/local/bin/altaris',
    ) + '\n')
    await gracefulShutdown(0)
  }

  // Standalone Bun-compiled binary (production install) — GitHub Releases'tan
  // self-update yap. installationType genelde 'unknown' veya 'native' olur
  // çünkü diagnostic npm/homebrew/winget tabanlı düşünüyor.
  if (diagnostic.installationType === 'unknown' ||
      diagnostic.installationType === 'native' ||
      diagnostic.installationType === 'npm-global' ||
      diagnostic.installationType === 'npm-local') {
    writeToStdout('\n')
    writeToStdout('GitHub Releases üzerinden güncelleniyor…\n')
    const result = await performGithubUpdate(MACRO.DISPLAY_VERSION)
    switch (result.kind) {
      case 'up_to_date':
        writeToStdout(chalk.green(`Altaris zaten güncel (${result.version})`) + '\n')
        await gracefulShutdown(0)
        break
      case 'updated':
        writeToStdout(chalk.green(
          `Altaris güncellendi: ${result.from} → ${result.to}`,
        ) + '\n')
        writeToStdout(chalk.dim(`Binary: ${result.binaryPath}`) + '\n')
        writeToStdout(chalk.bold("Yeniden başlatmak için terminal'i kapatıp aç veya `altaris` komutunu yeniden çağır.") + '\n')
        await regenerateCompletionCache().catch(() => {})
        await gracefulShutdown(0)
        break
      case 'no_asset':
        writeToStdout(chalk.yellow(
          `Release ${result.tag} bulundu ama platforma uygun asset yok (${result.expected}).`,
        ) + '\n')
        writeToStdout('https://github.com/argusteknoloji/altaris-super-agent-releases/releases adresinden manuel indir.\n')
        await gracefulShutdown(1)
        break
      case 'error':
        writeToStdout(chalk.red(`Güncelleme hatası: ${result.message}`) + '\n')
        writeToStdout('Manuel indirme: https://github.com/argusteknoloji/altaris-super-agent-releases/releases/latest\n')
        await gracefulShutdown(1)
        break
    }
  }

  // Check if running from a package manager
  if (diagnostic.installationType === 'package-manager') {
    const packageManager = await getPackageManager()
    writeToStdout('\n')

    if (packageManager === 'homebrew') {
      writeToStdout('Altaris is managed by Homebrew.\n')
      const latest = await getLatestVersion(channel)
      if (latest && !gte(MACRO.DISPLAY_VERSION, latest)) {
        writeToStdout(`Update available: ${MACRO.DISPLAY_VERSION} → ${latest}\n`)
        writeToStdout('\n')
        writeToStdout('To update, run:\n')
        writeToStdout(chalk.bold('  brew upgrade altaris') + '\n')
      } else {
        writeToStdout('Altaris is up to date!\n')
      }
    } else if (packageManager === 'winget') {
      writeToStdout('Altaris is managed by winget.\n')
      const latest = await getLatestVersion(channel)
      if (latest && !gte(MACRO.DISPLAY_VERSION, latest)) {
        writeToStdout(`Update available: ${MACRO.DISPLAY_VERSION} → ${latest}\n`)
        writeToStdout('\n')
        writeToStdout('To update, run:\n')
        writeToStdout(
          chalk.bold('  winget upgrade Anthropic.ClaudeCode') + '\n',
        )
      } else {
        writeToStdout('Altaris is up to date!\n')
      }
    } else if (packageManager === 'apk') {
      writeToStdout('Altaris is managed by apk.\n')
      const latest = await getLatestVersion(channel)
      if (latest && !gte(MACRO.DISPLAY_VERSION, latest)) {
        writeToStdout(`Update available: ${MACRO.DISPLAY_VERSION} → ${latest}\n`)
        writeToStdout('\n')
        writeToStdout('To update, run:\n')
        writeToStdout(chalk.bold('  apk upgrade altaris') + '\n')
      } else {
        writeToStdout('Altaris is up to date!\n')
      }
    } else {
      // pacman, deb, and rpm don't get specific commands because they each have
      // multiple frontends (pacman: yay/paru/makepkg, deb: apt/apt-get/aptitude/nala,
      // rpm: dnf/yum/zypper)
      writeToStdout('Altaris is managed by a package manager.\n')
      writeToStdout('Please use your package manager to update.\n')
    }

    await gracefulShutdown(0)
  }

  // Check for config/reality mismatch (skip for package-manager installs)
  if (
    config.installMethod &&
    diagnostic.configInstallMethod !== 'not set' &&
    diagnostic.installationType !== 'package-manager'
  ) {
    const runningType = diagnostic.installationType
    const configExpects = diagnostic.configInstallMethod

    // Map installation types for comparison
    const typeMapping: Record<string, string> = {
      'npm-local': 'local',
      'npm-global': 'global',
      native: 'native',
      development: 'development',
      unknown: 'unknown',
    }

    const normalizedRunningType = typeMapping[runningType] || runningType

    if (
      normalizedRunningType !== configExpects &&
      configExpects !== 'unknown'
    ) {
      writeToStdout('\n')
      writeToStdout(chalk.yellow('Warning: Configuration mismatch') + '\n')
      writeToStdout(`Config expects: ${configExpects} installation\n`)
      writeToStdout(`Currently running: ${runningType}\n`)
      writeToStdout(
        chalk.yellow(
          `Updating the ${runningType} installation you are currently using`,
        ) + '\n',
      )

      // Update config to match reality
      saveGlobalConfig(current => ({
        ...current,
        installMethod: normalizedRunningType as InstallMethod,
      }))
      writeToStdout(
        `Config updated to reflect current installation method: ${normalizedRunningType}\n`,
      )
    }
  }

  // Handle native installation updates first
  if (diagnostic.installationType === 'native') {
    logForDebugging(
      'update: Detected native installation, using native updater',
    )
    try {
      const result = await installLatestNative(channel, true)

      // Handle lock contention gracefully
      if (result.lockFailed) {
        const pidInfo = result.lockHolderPid
          ? ` (PID ${result.lockHolderPid})`
          : ''
        writeToStdout(
          chalk.yellow(
            `Another Altaris process${pidInfo} is currently running. Please try again in a moment.`,
          ) + '\n',
        )
        await gracefulShutdown(0)
      }

      if (!result.latestVersion) {
        process.stderr.write('Failed to check for updates\n')
        await gracefulShutdown(1)
      }

      if (result.latestVersion === MACRO.DISPLAY_VERSION) {
        writeToStdout(
          chalk.green(`Altaris is up to date (${MACRO.DISPLAY_VERSION})`) + '\n',
        )
      } else {
        writeToStdout(
          chalk.green(
            `Successfully updated from ${MACRO.DISPLAY_VERSION} to version ${result.latestVersion}`,
          ) + '\n',
        )
        await regenerateCompletionCache()
      }
      await gracefulShutdown(0)
    } catch (error) {
      process.stderr.write('Error: Failed to install native update\n')
      process.stderr.write(String(error) + '\n')
      process.stderr.write('Try running "altaris doctor" for diagnostics\n')
      await gracefulShutdown(1)
    }
  }

  // Fallback to existing JS/npm-based update logic
  // Remove native installer symlink since we're not using native installation
  // But only if user hasn't migrated to native installation
  if (config.installMethod !== 'native') {
    await removeInstalledSymlink()
  }

  logForDebugging('update: Checking npm registry for latest version')
  logForDebugging(`update: Package URL: ${MACRO.PACKAGE_URL}`)
  const npmTag = channel === 'stable' ? 'stable' : 'latest'
  const npmCommand = `npm view ${MACRO.PACKAGE_URL}@${npmTag} version`
  logForDebugging(`update: Running: ${npmCommand}`)
  const latestVersion = await getLatestVersion(channel)
  logForDebugging(
    `update: Latest version from npm: ${latestVersion || 'FAILED'}`,
  )

  if (!latestVersion) {
    logForDebugging('update: Failed to get latest version from npm registry')
    process.stderr.write(chalk.red('Failed to check for updates') + '\n')
    process.stderr.write('Unable to fetch latest version from npm registry\n')
    process.stderr.write('\n')
    process.stderr.write('Possible causes:\n')
    process.stderr.write('  • Network connectivity issues\n')
    process.stderr.write('  • npm registry is unreachable\n')
    process.stderr.write('  • Corporate proxy/firewall blocking npm\n')
    if (MACRO.PACKAGE_URL && !MACRO.PACKAGE_URL.startsWith('@anthropic')) {
      process.stderr.write(
        '  • Internal/development build not published to npm\n',
      )
    }
    process.stderr.write('\n')
    process.stderr.write('Try:\n')
    process.stderr.write('  • Check your internet connection\n')
    process.stderr.write('  • Run with --debug flag for more details\n')
    const packageName =
      MACRO.PACKAGE_URL ||
      (process.env.USER_TYPE === 'ant'
        ? '@anthropic-ai/claude-cli'
        : '@anthropic-ai/altaris')
    process.stderr.write(
      `  • Manually check: npm view ${packageName} version\n`,
    )

    process.stderr.write('  • Check if you need to login: npm whoami\n')
    await gracefulShutdown(1)
  }

  // Check if versions match exactly, including any build metadata (like SHA)
  if (latestVersion === MACRO.DISPLAY_VERSION) {
    writeToStdout(
      chalk.green(`Altaris is up to date (${MACRO.DISPLAY_VERSION})`) + '\n',
    )
    await gracefulShutdown(0)
  }

  writeToStdout(
    `New version available: ${latestVersion} (current: ${MACRO.DISPLAY_VERSION})\n`,
  )
  writeToStdout('Installing update...\n')

  // Determine update method based on what's actually running
  let useLocalUpdate = false
  let updateMethodName = ''

  switch (diagnostic.installationType) {
    case 'npm-local':
      useLocalUpdate = true
      updateMethodName = 'local'
      break
    case 'npm-global':
      useLocalUpdate = false
      updateMethodName = 'global'
      break
    case 'unknown': {
      // Fallback to detection if we can't determine installation type
      const isLocal = await localInstallationExists()
      useLocalUpdate = isLocal
      updateMethodName = isLocal ? 'local' : 'global'
      writeToStdout(
        chalk.yellow('Warning: Could not determine installation type') + '\n',
      )
      writeToStdout(
        `Attempting ${updateMethodName} update based on file detection...\n`,
      )
      break
    }
    default:
      process.stderr.write(
        `Error: Cannot update ${diagnostic.installationType} installation\n`,
      )
      await gracefulShutdown(1)
  }

  writeToStdout(`Using ${updateMethodName} installation update method...\n`)

  logForDebugging(`update: Update method determined: ${updateMethodName}`)
  logForDebugging(`update: useLocalUpdate: ${useLocalUpdate}`)

  let status: InstallStatus

  if (useLocalUpdate) {
    logForDebugging(
      'update: Calling installOrUpdateClaudePackage() for local update',
    )
    status = await installOrUpdateClaudePackage(channel)
  } else {
    logForDebugging('update: Calling installGlobalPackage() for global update')
    status = await installGlobalPackage()
  }

  logForDebugging(`update: Installation status: ${status}`)

  switch (status) {
    case 'success':
      writeToStdout(
        chalk.green(
          `Successfully updated from ${MACRO.DISPLAY_VERSION} to version ${latestVersion}`,
        ) + '\n',
      )
      await regenerateCompletionCache()
      break
    case 'no_permissions':
      process.stderr.write(
        'Error: Insufficient permissions to install update\n',
      )
      if (useLocalUpdate) {
        process.stderr.write('Try manually updating with:\n')
        process.stderr.write(
          `  cd ~/.altaris/local && npm update ${MACRO.PACKAGE_URL}\n`,
        )
      } else {
        process.stderr.write('Try running with sudo or fix npm permissions\n')
        process.stderr.write(
          'Or consider using native installation with: altaris install\n',
        )
      }
      await gracefulShutdown(1)
      break
    case 'install_failed':
      process.stderr.write('Error: Failed to install update\n')
      if (useLocalUpdate) {
        process.stderr.write('Try manually updating with:\n')
        process.stderr.write(
          `  cd ~/.altaris/local && npm update ${MACRO.PACKAGE_URL}\n`,
        )
      } else {
        process.stderr.write(
          'Or consider using native installation with: altaris install\n',
        )
      }
      await gracefulShutdown(1)
      break
    case 'in_progress':
      process.stderr.write(
        'Error: Another instance is currently performing an update\n',
      )
      process.stderr.write('Please wait and try again later\n')
      await gracefulShutdown(1)
      break
  }
  await gracefulShutdown(0)
}
