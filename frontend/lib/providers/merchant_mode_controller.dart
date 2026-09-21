import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../sandbox/merchant_mode.dart';
import '../sandbox/store.dart';

const merchantModePrefsKey = 'cryptochain.merchant_mode';

class MerchantModeController extends Notifier<MerchantMode> {
  @override
  MerchantMode build() {
    Future.microtask(_restore);
    return MerchantMode.live;
  }

  Future<void> _restore() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      if (prefs.getString(merchantModePrefsKey) == MerchantMode.sandbox.name) {
        await setMode(MerchantMode.sandbox);
      }
    } catch (_) {}
  }

  Future<void> setMode(MerchantMode mode) async {
    state = mode;
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString(merchantModePrefsKey, mode.name);
    } catch (_) {}
    if (mode == MerchantMode.sandbox) {
      await ref.read(sandboxStoreProvider.notifier).ensureReady();
    }
  }
}

final merchantModeProvider = NotifierProvider<MerchantModeController, MerchantMode>(
  MerchantModeController.new,
);

final isSandboxProvider = Provider<bool>(
  (ref) => ref.watch(merchantModeProvider) == MerchantMode.sandbox,
);
