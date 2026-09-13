/// Values baked in with `--dart-define=NAME=value`. Empty string means "use dotenv".
class CompileTimeDefines {
  const CompileTimeDefines({
    this.enableLiveMode = false,
    this.sandboxApiBaseUrl = '',
    this.sandboxMerchantId = '',
    this.sandboxApiKey = '',
    this.liveApiBaseUrl = '',
    this.liveMerchantId = '',
    this.liveApiKey = '',
  });

  factory CompileTimeDefines.fromEnvironment() {
    return const CompileTimeDefines(
      enableLiveMode: bool.fromEnvironment('ENABLE_LIVE_MODE'),
      sandboxApiBaseUrl: String.fromEnvironment('SANDBOX_API_BASE_URL'),
      sandboxMerchantId: String.fromEnvironment('SANDBOX_MERCHANT_ID'),
      sandboxApiKey: String.fromEnvironment('SANDBOX_API_KEY'),
      liveApiBaseUrl: String.fromEnvironment('LIVE_API_BASE_URL'),
      liveMerchantId: String.fromEnvironment('LIVE_MERCHANT_ID'),
      liveApiKey: String.fromEnvironment('LIVE_API_KEY'),
    );
  }

  final bool enableLiveMode;
  final String sandboxApiBaseUrl;
  final String sandboxMerchantId;
  final String sandboxApiKey;
  final String liveApiBaseUrl;
  final String liveMerchantId;
  final String liveApiKey;
}
