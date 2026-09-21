import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../sandbox/merchant_mode.dart';
import '../sandbox/store.dart';

const merchantModePrefsKey = 'cryptochain.merchant_mode';

class MerchantModeController extends Notifier<MerchantMode> {
  var _userChoseMode = false;

  @override
  MerchantMode build() {
    Future.microtask(_restore);
    // Local / first-run default: simulated data, no backend required.
    return MerchantMode.sandbox;
  }

  Future<void> _restore() async {
    // Always cold-start in SANDBOX so localhost works with no Node/Postgres.
    // LIVE is opt-in from the top-nav pill for the current session only.
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString(merchantModePrefsKey, MerchantMode.sandbox.name);
    } catch (_) {}
    if (_userChoseMode) return;
    await setMode(MerchantMode.sandbox);
  }

  Future<void> setMode(MerchantMode mode) async {
    _userChoseMode = true;
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
