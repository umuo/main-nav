export class ConfigurationError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'ConfigurationError';
    }
}

export function requireEnv(name: string, minLength = 1): string {
    const value = process.env[name];

    if (!value || value.trim().length < minLength || value.includes('replace-with-')) {
        throw new ConfigurationError(
            `${name} must be configured${minLength > 1 ? ` with at least ${minLength} characters` : ''}`
        );
    }

    return value;
}
