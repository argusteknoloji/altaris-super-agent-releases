/**
 * Backend hata yanıtlarını CLI'ın kullanıcıya gösterdiği actionable mesajlara
 * çevirir. Özellikle yeni capability sistemine bağlı 403'leri parse eder:
 *
 *   { "error": "forbidden", "missing_capability": "vault.delete" }
 *
 * Yerine generic "HTTP 403" yerine kullanıcı tam ne eksik olduğunu görür.
 */

const CAP_TR: Record<string, string> = {
  "chat.use":                "Sohbet kullanımı",
  "chat.attach_files":       "Dosya/resim eki",
  "session.create":          "Oturum açma",
  "session.view_own":        "Kendi oturumlarını görüntüleme",
  "session.view_all":        "Tenant oturumlarını görüntüleme",
  "vault.read":              "Vault okuma",
  "vault.write":             "Vault yazma",
  "vault.create":            "Vault oluşturma",
  "vault.delete":            "Vault silme",
  "vault.share":             "Vault visibility değiştirme",
  "remote_control.publish":  "Kendi oturumunu yayınlama",
  "remote_control.view":     "Başkasının yayınını izleme",
  "remote_control.takeover": "Başkasının oturumunu devralma",
  "admin.users":             "Kullanıcı yönetimi",
  "admin.providers":         "Provider config yönetimi",
  "admin.audit":             "Audit log okuma",
  "admin.invitations":       "Davet yönetimi",
  "admin.tenants":           "Tenant yönetimi",
  "api_key.create":          "API key oluşturma",
  "api_key.list_own":        "Kendi API key listesi",
  "api_key.list_all":        "Tüm API key listesi",
};

export interface FriendlyApiError {
  /** Kullanıcıya gösterilecek tek-satır mesaj. */
  message: string;
  /** True ise kullanıcı bir aksiyon almalı (login, admin'e haber, vb). */
  actionable: boolean;
  /** İlgili HTTP status (debug için). */
  status: number;
}

/**
 * Bir fetch Response'u (cevap NOT ok ise) parse edip CLI-friendly mesaja çevir.
 * - 401  → token süresi/yokluğu
 * - 403 + JSON.missing_capability → "X yetkin yok, admin'den iste"
 * - 403 generic → "Yetki yok"
 * - 404 → kaynak bulunamadı
 * - 409 → çakışma (conflict)
 * - 5xx → sunucu hatası
 *
 * Hata olmadığı durumda (response.ok) null döner — caller normal akışına devam.
 */
export async function describeApiError(res: Response): Promise<FriendlyApiError | null> {
  if (res.ok) return null;

  let body: Record<string, unknown> = {};
  try {
    const text = await res.clone().text();
    if (text.trim().startsWith("{")) body = JSON.parse(text);
  } catch { /* opaque body */ }

  if (res.status === 401) {
    return {
      status: 401,
      actionable: true,
      message: "Giriş gerekli veya token süresi dolmuş — `altaris login` ile yenile.",
    };
  }

  if (res.status === 403) {
    const missing = typeof body.missing_capability === "string" ? body.missing_capability : null;
    if (missing) {
      const tr = CAP_TR[missing] ?? missing;
      return {
        status: 403,
        actionable: true,
        message: `Bu işlem için '${tr}' (${missing}) yetkisi gerekiyor — tenant adminine danış.`,
      };
    }
    return {
      status: 403,
      actionable: true,
      message: "Yetki yok — bu işlemi tenant adminin yapabilir veya rolünün değiştirilmesi gerekir.",
    };
  }

  if (res.status === 404) {
    return { status: 404, actionable: false, message: "Kaynak bulunamadı." };
  }

  if (res.status === 409) {
    const err = typeof body.error === "string" ? body.error : "çakışma";
    return { status: 409, actionable: true, message: `Çakışma: ${err}` };
  }

  if (res.status >= 500) {
    return {
      status: res.status,
      actionable: false,
      message: `Sunucu hatası (HTTP ${res.status}). Birkaç dakika sonra tekrar dene; problem sürerse yöneticini ara.`,
    };
  }

  // 4xx generic
  const err = typeof body.error === "string" ? body.error : `HTTP ${res.status}`;
  return { status: res.status, actionable: false, message: err };
}

/**
 * Convenience wrapper: fetch + non-OK → process.stderr'e friendly mesaj +
 * exit code döndürür. Caller `if (code !== 0) process.exit(code)` yapar.
 *
 * Returns:
 *   { ok: true,  data }       → response.ok ise body parse edildi
 *   { ok: false, code: 1|2 }  → mesaj zaten yazıldı, caller exit
 */
export async function fetchWithFriendlyErrors<T = unknown>(
  url: string,
  init?: RequestInit
): Promise<{ ok: true; data: T } | { ok: false; code: number }> {
  let res: Response;
  try {
    res = await fetch(url, init);
  } catch (e) {
    process.stderr.write(`Bağlantı hatası: ${(e as Error).message}\n`);
    return { ok: false, code: 1 };
  }
  const friendly = await describeApiError(res);
  if (friendly) {
    process.stderr.write(`${friendly.message}\n`);
    return { ok: false, code: friendly.actionable ? 1 : 2 };
  }
  if (res.status === 204) return { ok: true, data: undefined as T };
  const data = await res.json() as T;
  return { ok: true, data };
}
