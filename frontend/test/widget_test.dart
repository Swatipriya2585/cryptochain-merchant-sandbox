import 'package:cryptochain_merchant/config/app_mode.dart';
import 'package:cryptochain_merchant/data/models/merchant_summary.dart';
import 'package:cryptochain_merchant/providers/payments_providers.dart';
import 'package:cryptochain_merchant/screens/dashboard_home_screen.dart';
import 'package:cryptochain_merchant/widgets/mode_banner.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';

void main() {
  testWidgets('sandbox banner is amber and always labeled SANDBOX MODE', (tester) async {
    await tester.pumpWidget(
      const MaterialApp(home: Scaffold(body: ModeBannerView(mode: AppMode.sandbox))),
    );

    expect(find.textContaining('SANDBOX MODE'), findsOneWidget);
    final material = tester.widget<Material>(find.byType(Material).last);
    expect(material.color, const Color(0xFFFFC107));
  });

  testWidgets('dashboard cards render summary stats', (tester) async {
    const summary = MerchantSummary(
      merchantId: 'merchant_sandbox_seed',
      network: 'sepolia',
      totalConfirmedVolumeCrypto: '0.06',
      currencyCrypto: 'ETH',
      pendingCount: 2,
      confirmedCount: 3,
      expiredCount: 1,
      totalPaymentIntents: 8,
      successRate: 0.375,
      successRatePercent: 37.5,
      avgConfirmationTimeSeconds: 120,
      payoutsPending: 1,
      payoutsPaid: 1,
    );

    final router = GoRouter(
      routes: [
        GoRoute(
          path: '/',
          builder: (context, state) => const DashboardHomeScreen(),
        ),
        GoRoute(path: '/payments/new', builder: (context, state) => const SizedBox()),
      ],
    );

    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          summaryProvider.overrideWith((ref) async => summary),
        ],
        child: MaterialApp.router(routerConfig: router),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('Total confirmed'), findsOneWidget);
    expect(find.text('0.06 ETH'), findsOneWidget);
    expect(find.text('Pending'), findsOneWidget);
    expect(find.text('2'), findsOneWidget);
    expect(find.text('Success rate'), findsOneWidget);
    expect(find.text('37.5%'), findsOneWidget);
  });
}
