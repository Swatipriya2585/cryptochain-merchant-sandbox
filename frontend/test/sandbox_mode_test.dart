import 'package:cryptochain_merchant/sandbox/merchant_mode.dart';
import 'package:cryptochain_merchant/sandbox/sandbox_repository.dart';
import 'package:cryptochain_merchant/sandbox/seed.dart';
import 'package:cryptochain_merchant/sandbox/seeded_rng.dart';
import 'package:cryptochain_merchant/sandbox/store.dart';
import 'package:cryptochain_merchant/providers/merchant_mode_controller.dart';
import 'package:cryptochain_merchant/screens/dashboard_home_screen.dart';
import 'package:cryptochain_merchant/screens/smart_send_screen.dart';
import 'package:cryptochain_merchant/screens/wallets_screen.dart';
import 'package:cryptochain_merchant/widgets/mode_toggle.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  setUp(() {
    SharedPreferences.setMockInitialValues({});
  });

  test('canonical seed is deterministic across generate() calls', () {
    final a = SandboxSeed.generate();
    final b = SandboxSeed.generate();
    expect(a.metrics.portfolioUsd, b.metrics.portfolioUsd);
    expect(a.metrics.successRatePercent, 97.8);
    expect(a.apiKey, startsWith('sk_sandbox_'));
    expect(a.wallets, hasLength(2));
    expect(a.wallets.first.address, startsWith('0xSANDBOX'));
    expect(a.payments, hasLength(8));
    expect(a.invoices, hasLength(8));
    expect(a.customers, hasLength(8));
    expect(a.settlements.where((s) => s.status == 'pending').length, greaterThanOrEqualTo(1));
  });

  test('seeded RNG is stable', () {
    expect(SeededRandom(42).range(1, 2), SeededRandom(42).range(1, 2));
  });

  test('sandbox repository never needs a live API session', () async {
    final container = ProviderContainer();
    addTearDown(container.dispose);
    final repo = SandboxCryptochainRepository(container.read(sandboxStoreProvider.notifier));
    final summary = await repo.getSummary();
    expect(summary.network, 'sandbox');
    expect(summary.successRatePercent, 97.8);
    final page = await repo.listPaymentIntents();
    expect(page.items, isNotEmpty);
    final created = await repo.createPaymentIntent(
      amountRequestedCrypto: '0.10',
      currencyCrypto: 'ETH',
      expiresInMinutes: 30,
    );
    expect(created.id, startsWith('sbx_pay_'));
    expect(created.expectedAddress, isNotEmpty);
  });

  testWidgets('LIVE / SANDBOX toggle is visible and switches chrome', (tester) async {
    await tester.pumpWidget(
      const ProviderScope(
        child: MaterialApp(home: Scaffold(body: MerchantChrome())),
      ),
    );
    await tester.pump();

    expect(find.text('LIVE'), findsOneWidget);
    expect(find.text('SANDBOX'), findsOneWidget);

    await tester.tap(find.text('SANDBOX'));
    await tester.pumpAndSettle();

    expect(
      find.text("You're in Sandbox Mode — all data shown is simulated."),
      findsOneWidget,
    );
  });

  testWidgets('sandbox dashboard shows simulated portfolio instead of Unavailable', (tester) async {
    await tester.binding.setSurfaceSize(const Size(1200, 2400));
    addTearDown(() => tester.binding.setSurfaceSize(null));

    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          merchantModeProvider.overrideWith(_SandboxMode.new),
          isSandboxProvider.overrideWith((ref) => true),
        ],
        child: const MaterialApp(home: DashboardHomeScreen()),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('Wallet portfolio balance'), findsOneWidget);
    expect(find.text('Unavailable'), findsNothing);
    expect(find.text('Unavailable — no metric in backend'), findsNothing);
    expect(find.text('97.8%'), findsWidgets);
    expect(
      find.text('Import your real wallet address to receive mainnet payments'),
      findsNothing,
    );
  });

  testWidgets('Smart Send review confirm is enabled after a mock quote', (tester) async {
    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          merchantModeProvider.overrideWith(_SandboxMode.new),
          isSandboxProvider.overrideWith((ref) => true),
          smartSendFinalityDelayProvider.overrideWith((ref) => Duration.zero),
        ],
        child: const MaterialApp(home: SmartSendScreen()),
      ),
    );
    await tester.pumpAndSettle();

    await tester.tap(find.text('Start Smart Send'));
    await tester.pumpAndSettle();

    final confirm = find.text('Review & confirm');
    expect(confirm, findsOneWidget);
    final button = tester.widget<FilledButton>(
      find.ancestor(of: confirm, matching: find.byType(FilledButton)),
    );
    expect(button.onPressed, isNotNull);

    await tester.tap(confirm);
    await tester.pumpAndSettle();
    expect(find.textContaining('Tx hash: 0xsandbox'), findsOneWidget);
  });

  testWidgets('sandbox wallet receive dialog shows the mock address', (tester) async {
    await tester.binding.setSurfaceSize(const Size(1200, 2400));
    addTearDown(() => tester.binding.setSurfaceSize(null));

    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          merchantModeProvider.overrideWith(_SandboxMode.new),
          isSandboxProvider.overrideWith((ref) => true),
        ],
        child: const MaterialApp(home: WalletsScreen()),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('Sandbox Treasury'), findsWidgets);
    await tester.ensureVisible(find.text('Receive money'));
    await tester.tap(find.text('Receive money'));
    await tester.pumpAndSettle();
    expect(find.textContaining('0xSANDBOX'), findsWidgets);
    expect(find.text('Copy address'), findsOneWidget);
  });
}

class _SandboxMode extends MerchantModeController {
  @override
  MerchantMode build() => MerchantMode.sandbox;
}
