declare namespace Express {
  interface Request {
    rawBody?: Buffer;
    merchant?: {
      id: string;
      webhookUrl: string | null;
      webhookSecret: string;
      apiKeyHash: string;
      createdAt: Date;
      updatedAt: Date;
    };
  }
}
