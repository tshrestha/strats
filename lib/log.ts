const secrets = new Set<string>();

export function trackSecret(value: string | undefined): void {
  if (value && value.length >= 8) {
    secrets.add(value);
  }
}

function redact(text: string): string {
  let out = text;
  for (const secret of secrets) {
    if (secret && out.includes(secret)) {
      out = out.split(secret).join("<redacted>");
    }
  }
  return out;
}

export function log(message: string): void {
  process.stdout.write(redact(message) + "\n");
}

export function logError(message: string): void {
  process.stderr.write(redact(message) + "\n");
}
