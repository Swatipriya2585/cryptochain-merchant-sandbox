import 'package:flutter_dotenv/flutter_dotenv.dart';

import 'app_mode.dart';
import 'compile_time.dart';
import 'env_profile.dart';

const sandboxEnvAsset = 'assets/config/sandbox.env';
const liveEnvAsset = 'assets/config/live.env';

String _pick(String dartDefine, String fromFile, String fallback) {
  if (dartDefine.trim().isNotEmpty) return dartDefine.trim();
  if (fromFile.trim().isNotEmpty) return fromFile.trim();
  return fallback;
}

Future<Map<String, String>> loadDotenvAsset(String assetPath) async {
  final file = DotEnv();
  await file.load(fileName: assetPath, isOptional: true);
  return Map<String, String>.from(file.env);
}

EnvProfile buildProfile({
  required AppMode mode,
  required Map<String, String> fileValues,
  required CompileTimeDefines defines,
  String? merchantIdOverride,
  String? apiKeyOverride,
}) {
  if (mode == AppMode.sandbox) {
    return EnvProfile(
      mode: AppMode.sandbox,
      apiBaseUrl: _pick(
        defines.sandboxApiBaseUrl,
        fileValues['API_BASE_URL'] ?? '',
        'http://127.0.0.1:4000',
      ),
      merchantId: merchantIdOverride ??
          _pick(defines.sandboxMerchantId, fileValues['MERCHANT_ID'] ?? '', ''),
      apiKey:
          apiKeyOverride ?? _pick(defines.sandboxApiKey, fileValues['API_KEY'] ?? '', ''),
      chainName: fileValues['CHAIN_NAME'] ?? 'Sepolia',
    );
  }

  return EnvProfile(
    mode: AppMode.live,
    apiBaseUrl: _pick(defines.liveApiBaseUrl, fileValues['API_BASE_URL'] ?? '', ''),
    merchantId:
        merchantIdOverride ?? _pick(defines.liveMerchantId, fileValues['MERCHANT_ID'] ?? '', ''),
    apiKey: apiKeyOverride ?? _pick(defines.liveApiKey, fileValues['API_KEY'] ?? '', ''),
    chainName: fileValues['CHAIN_NAME'] ?? 'Mainnet',
  );
}
