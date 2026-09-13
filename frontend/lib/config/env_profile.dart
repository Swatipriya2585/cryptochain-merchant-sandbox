import 'app_mode.dart';
import 'env_policy.dart';

class EnvProfile {
  const EnvProfile({
    required this.mode,
    required this.apiBaseUrl,
    required this.merchantId,
    required this.apiKey,
    required this.chainName,
  });

  final AppMode mode;
  final String apiBaseUrl;
  final String merchantId;
  final String apiKey;
  final String chainName;

  bool get isConfigured =>
      apiBaseUrl.trim().isNotEmpty &&
      merchantId.trim().isNotEmpty &&
      apiKey.trim().isNotEmpty;

  EnvProfile copyWith({
    AppMode? mode,
    String? apiBaseUrl,
    String? merchantId,
    String? apiKey,
    String? chainName,
  }) {
    return EnvProfile(
      mode: mode ?? this.mode,
      apiBaseUrl: apiBaseUrl ?? this.apiBaseUrl,
      merchantId: merchantId ?? this.merchantId,
      apiKey: apiKey ?? this.apiKey,
      chainName: chainName ?? this.chainName,
    );
  }
}

class EnvSession {
  const EnvSession({
    required this.profile,
    required this.policy,
    required this.bundledSandbox,
    required this.bundledLive,
  });

  final EnvProfile profile;
  final EnvPolicy policy;
  final EnvProfile bundledSandbox;
  final EnvProfile bundledLive;

  AppMode get mode => profile.mode;
  bool get isSandbox => mode == AppMode.sandbox;
}
