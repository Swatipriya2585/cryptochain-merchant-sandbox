import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../config/app_mode.dart';
import '../config/compile_time.dart';
import '../config/env_loader.dart';
import '../config/env_policy.dart';
import '../config/env_profile.dart';

const _modePref = 'cryptochain.app_mode';
const _merchantPref = 'cryptochain.merchant_id';
const _apiKeyPref = 'cryptochain.api_key';

class EnvController extends AsyncNotifier<EnvSession> {
  CompileTimeDefines get _defines => CompileTimeDefines.fromEnvironment();

  EnvPolicy get _policy => EnvPolicy(
    isReleaseBuild: kReleaseMode,
    enableLiveModeFlag: _defines.enableLiveMode,
  );

  @override
  Future<EnvSession> build() => _load();

  Future<EnvSession> _load() async {
    final prefs = await SharedPreferences.getInstance();
    final sandboxFile = await loadDotenvAsset(sandboxEnvAsset);
    final liveFile = await loadDotenvAsset(liveEnvAsset);
    final bundledSandbox = buildProfile(
      mode: AppMode.sandbox,
      fileValues: sandboxFile,
      defines: _defines,
    );
    final bundledLive = buildProfile(
      mode: AppMode.live,
      fileValues: liveFile,
      defines: _defines,
    );

    final requested = AppMode.values.firstWhere(
      (mode) => mode.name == prefs.getString(_modePref),
      orElse: () => AppMode.sandbox,
    );
    final mode = _policy.coerce(requested);
    if (mode != requested) {
      await prefs.setString(_modePref, mode.name);
    }

    final merchantOverride = prefs.getString(_merchantPref);
    final apiKeyOverride = prefs.getString(_apiKeyPref);
    final source = mode == AppMode.sandbox ? bundledSandbox : bundledLive;
    final profile = source.copyWith(
      merchantId: (merchantOverride != null && merchantOverride.isNotEmpty)
          ? merchantOverride
          : source.merchantId,
      apiKey: (apiKeyOverride != null && apiKeyOverride.isNotEmpty)
          ? apiKeyOverride
          : source.apiKey,
    );

    return EnvSession(
      profile: profile,
      policy: _policy,
      bundledSandbox: bundledSandbox,
      bundledLive: bundledLive,
    );
  }

  Future<void> selectMode(AppMode requested) async {
    final current = state.value;
    if (current == null) return;
    final mode = current.policy.coerce(requested);
    if (requested == AppMode.live && !current.policy.canSelectLive) {
      return;
    }
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_modePref, mode.name);
    state = await AsyncValue.guard(_load);
  }

  Future<void> saveCredentials({required String merchantId, required String apiKey}) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_merchantPref, merchantId.trim());
    await prefs.setString(_apiKeyPref, apiKey.trim());
    state = await AsyncValue.guard(_load);
  }
}

final envControllerProvider = AsyncNotifierProvider<EnvController, EnvSession>(
  EnvController.new,
);
