import 'package:cryptochain_merchant/config/app_mode.dart';
import 'package:cryptochain_merchant/config/env_policy.dart';
import 'package:cryptochain_merchant/core/api_exception.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  group('EnvPolicy', () {
    test('release builds cannot select LIVE without ENABLE_LIVE_MODE', () {
      const policy = EnvPolicy(isReleaseBuild: true, enableLiveModeFlag: false);
      expect(policy.canSelectLive, isFalse);
      expect(policy.showModeToggle, isFalse);
      expect(policy.coerce(AppMode.live), AppMode.sandbox);
      expect(policy.coerce(AppMode.sandbox), AppMode.sandbox);
    });

    test('release builds can select LIVE when ENABLE_LIVE_MODE is compiled in', () {
      const policy = EnvPolicy(isReleaseBuild: true, enableLiveModeFlag: true);
      expect(policy.canSelectLive, isTrue);
      expect(policy.showModeToggle, isTrue);
      expect(policy.coerce(AppMode.live), AppMode.live);
    });

    test('debug builds may switch to LIVE', () {
      const policy = EnvPolicy(isReleaseBuild: false, enableLiveModeFlag: false);
      expect(policy.canSelectLive, isTrue);
      expect(policy.showModeToggle, isTrue);
      expect(policy.coerce(AppMode.live), AppMode.live);
    });
  });

  group('ApiException', () {
    test('maps 401 to a merchant-friendly API key message', () {
      final error = ApiException.fromEnvelope(
        statusCode: 401,
        error: {
          'message': 'Invalid API key',
          'fields': [
            {'field': 'X-API-Key', 'message': 'No merchant matches this API key'},
          ],
        },
      );
      expect(error.merchantMessage, contains("isn't valid"));
      expect(error.merchantMessage, isNot(contains('No merchant matches')));
    });

    test('maps 400 field errors to labeled copy', () {
      final error = ApiException.fromEnvelope(
        statusCode: 400,
        error: {
          'message': 'Validation failed',
          'fields': [
            {'field': 'amountRequestedCrypto', 'message': 'must be greater than zero'},
          ],
        },
      );
      expect(error.merchantMessage, contains('Amount'));
      expect(error.merchantMessage, contains('must be greater than zero'));
    });

    test('maps connection failures without technical jargon', () {
      expect(ApiException.network().merchantMessage, contains("Can't reach"));
      expect(ApiException.network().merchantMessage.toLowerCase(), isNot(contains('socket')));
    });
  });
}
