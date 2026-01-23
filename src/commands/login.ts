interface LoginOptions {
  noBrowser?: boolean;
  port?: number;
}

export async function loginCommand(options: LoginOptions): Promise<void> {}
