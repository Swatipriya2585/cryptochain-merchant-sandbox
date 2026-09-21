/// Stripe-style merchant experience mode.
///
/// This is independent of [AppMode] (Sepolia vs mainnet API target). LIVE still
/// talks to the existing Prisma-backed API. SANDBOX never touches that API,
/// Prisma, or any chain/RPC/DEX client — it reads [SandboxStore] only.
enum MerchantMode {
  live,
  sandbox;

  String get pillLabel => switch (this) {
    MerchantMode.live => 'LIVE',
    MerchantMode.sandbox => 'SANDBOX',
  };
}
