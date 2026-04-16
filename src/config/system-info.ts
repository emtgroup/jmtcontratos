// Metadados vindos do build (injetados em vite.config.ts em tempo de compilação).
declare const __APP_VERSION__: string;
declare const __APP_COMMIT_SHA__: string | null;
declare const __APP_COMMIT_DATE_ISO__: string | null;

const APP_TIMEZONE = "America/Cuiaba";

function formatCommitDate(commitDateIso: string | null): string | null {
  if (!commitDateIso) {
    return null;
  }

  const parsedDate = new Date(commitDateIso);
  if (Number.isNaN(parsedDate.getTime())) {
    return null;
  }

  // Timezone fixo para Cuiabá/MT por regra de negócio do projeto,
  // evitando depender do timezone do navegador/servidor.
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: APP_TIMEZONE,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(parsedDate);
}

const formattedCommitDate = formatCommitDate(__APP_COMMIT_DATE_ISO__);
const shortCommitSha = __APP_COMMIT_SHA__?.slice(0, 7) ?? null;

export const systemInfo = {
  version: `v${__APP_VERSION__}`,
  versionWithCommit: shortCommitSha ? `v${__APP_VERSION__} (${shortCommitSha})` : `v${__APP_VERSION__}`,
  // Fallback seguro: sem metadado real de commit/build não exibimos data de atualização.
  lastUpdated: formattedCommitDate,
} as const;
