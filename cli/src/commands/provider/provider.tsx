import * as React from 'react'

import type { LocalJSXCommandCall, LocalJSXCommandOnDone } from '../../types/command.js'
import { COMMON_HELP_ARGS, COMMON_INFO_ARGS } from '../../constants/xml.js'
import {
  Select,
  type OptionWithDescription,
} from '../../components/CustomSelect/index.js'
import { Dialog } from '../../components/design-system/Dialog.js'
import { LoadingState } from '../../components/design-system/LoadingState.js'
import { Box, Text } from '../../ink.js'
import {
  applyProvider,
  fetchActiveProvider,
  fetchProviderList,
  readToken,
  type ProviderListItem,
} from '../../argus/bootstrap.js'

type LoadState =
  | { kind: 'loading' }
  | { kind: 'no-token' }
  | { kind: 'error'; message: string }
  | { kind: 'empty' }
  | { kind: 'ready'; token: string; items: ProviderListItem[] }
  | { kind: 'switching'; label: string }

function formatLabel(item: ProviderListItem): string {
  const star = item.isDefault ? '★ ' : '  '
  return `${star}${item.name}`
}

function formatDescription(item: ProviderListItem): string {
  const parts: string[] = [item.provider]
  if (item.defaultModel) parts.push(item.defaultModel)
  if (item.isDefault) parts.push('default')
  return parts.join(' · ')
}

function TenantProviderPicker({
  onDone,
}: {
  onDone: LocalJSXCommandOnDone
}): React.ReactNode {
  const [state, setState] = React.useState<LoadState>({ kind: 'loading' })

  React.useEffect(() => {
    let cancelled = false

    void (async () => {
      const token = await readToken()
      if (cancelled) return
      if (!token) {
        setState({ kind: 'no-token' })
        return
      }

      const items = await fetchProviderList(token)
      if (cancelled) return
      if (!items) {
        setState({
          kind: 'error',
          message:
            'Provider listesi alınamadı. API erişilebilir mi (ALTARIS_API_BASE) ve oturum geçerli mi kontrol edin.',
        })
        return
      }
      if (items.length === 0) {
        setState({ kind: 'empty' })
        return
      }
      setState({ kind: 'ready', token, items })
    })()

    return () => {
      cancelled = true
    }
  }, [])

  const handleSelect = React.useCallback(
    async (id: string) => {
      if (state.kind !== 'ready') return
      const picked = state.items.find(i => i.id === id)
      const label = picked?.name ?? id
      setState({ kind: 'switching', label })

      const active = await fetchActiveProvider(state.token, { id })
      if (!active) {
        onDone(
          `Provider switch failed: ${label} için tam credentials alınamadı.`,
          { display: 'system' },
        )
        return
      }

      const applied = applyProvider(active, { force: true })
      const modelLabel = active.model ?? '(no default model)'
      const message = [
        `Switched provider: ${active.name}`,
        `Type: ${active.provider}`,
        `Model: ${modelLabel}`,
        active.baseUrl ? `Endpoint: ${active.baseUrl}` : null,
        applied.length > 0 ? `Applied: ${applied.join(', ')}` : null,
      ]
        .filter(Boolean)
        .join('\n')

      onDone(message, {
        display: 'system',
        metaMessages: [
          `<system-reminder>Provider switched mid-session to ${active.name}${
            active.model ? ` using model ${active.model}` : ''
          }. Use this provider/model for subsequent requests unless the user switches again.</system-reminder>`,
        ],
      })
    },
    [onDone, state],
  )

  if (state.kind === 'loading') {
    return <LoadingState message="Tenant provider listesi alınıyor…" />
  }

  if (state.kind === 'switching') {
    return <LoadingState message={`Provider değiştiriliyor: ${state.label}…`} />
  }

  if (state.kind === 'no-token') {
    return (
      <Dialog title="Login gerekli" onCancel={() => onDone()} color="warning">
        <Box flexDirection="column" gap={1}>
          <Text>
            Provider yönetimi platform üzerinden çalışıyor. Önce{' '}
            <Text bold>altaris login</Text> ile oturum açın, sonra tekrar{' '}
            <Text bold>/provider</Text> komutunu çalıştırın.
          </Text>
        </Box>
      </Dialog>
    )
  }

  if (state.kind === 'error') {
    return (
      <Dialog title="Provider listesi alınamadı" onCancel={() => onDone()} color="warning">
        <Box flexDirection="column" gap={1}>
          <Text>{state.message}</Text>
        </Box>
      </Dialog>
    )
  }

  if (state.kind === 'empty') {
    return (
      <Dialog title="Tanımlı provider yok" onCancel={() => onDone()} color="warning">
        <Box flexDirection="column" gap={1}>
          <Text>
            Tenant'ınızda etkin (enabled) bir provider yok. Web admin paneline
            (<Text bold>/admin/providers</Text>) gidip en az bir provider
            tanımlayın.
          </Text>
        </Box>
      </Dialog>
    )
  }

  const options: OptionWithDescription<string>[] = state.items.map(item => ({
    label: formatLabel(item),
    value: item.id,
    description: formatDescription(item),
  }))

  const activeId = process.env.ALTARIS_ACTIVE_PROVIDER_ID
  const defaultValue =
    (activeId && state.items.find(i => i.id === activeId)?.id) ||
    state.items.find(i => i.isDefault)?.id ||
    state.items[0]?.id

  return (
    <Dialog
      title="Provider seç"
      subtitle="Tenant'ınızda tanımlı provider'lardan birine geç"
      onCancel={() => onDone()}
    >
      <Box flexDirection="column" gap={1}>
        <Text dimColor>
          Aktif:{' '}
          {process.env.ALTARIS_ACTIVE_PROVIDER_NAME ?? '(bilinmiyor)'}
          {process.env.ALTARIS_ACTIVE_PROVIDER_MODEL
            ? ` · ${process.env.ALTARIS_ACTIVE_PROVIDER_MODEL}`
            : ''}
        </Text>
        <Select
          options={options}
          defaultValue={defaultValue}
          defaultFocusValue={defaultValue}
          inlineDescriptions
          visibleOptionCount={Math.min(10, options.length)}
          onChange={(value: string) => {
            void handleSelect(value)
          }}
          onCancel={() => onDone()}
        />
      </Box>
    </Dialog>
  )
}

export const call: LocalJSXCommandCall = async (onDone, _context, args) => {
  const trimmedArgs = args?.trim().toLowerCase() ?? ''

  if (
    COMMON_HELP_ARGS.includes(trimmedArgs) ||
    COMMON_INFO_ARGS.includes(trimmedArgs) ||
    trimmedArgs === 'help' ||
    trimmedArgs === '--help' ||
    trimmedArgs === '-h'
  ) {
    onDone(
      'Run /provider to switch between provider configurations defined for your tenant in the web admin panel (/admin/providers).',
      { display: 'system' },
    )
    return
  }

  return <TenantProviderPicker onDone={onDone} />
}
