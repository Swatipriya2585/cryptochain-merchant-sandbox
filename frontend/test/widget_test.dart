import 'package:cryptochain_merchant/config/app_mode.dart';
import 'package:cryptochain_merchant/data/models/merchant_summary.dart';
import 'package:cryptochain_merchant/providers/merchant_mode_controller.dart';
import 'package:cryptochain_merchant/providers/payments_providers.dart';
import 'package:cryptochain_merchant/sandbox/merchant_mode.dart';
import 'package:cryptochain_merchant/providers/auth_controller.dart';
import 'package:cryptochain_merchant/screens/login_screen.dart';
import 'package:cryptochain_merchant/screens/signup_screen.dart';
import 'package:cryptochain_merchant/screens/dashboard_home_screen.dart';
import 'package:cryptochain_merchant/widgets/mode_banner.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:shared_preferences/shared_preferences.dart';

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
          merchantModeProvider.overrideWith(_LiveMode.new),
          isSandboxProvider.overrideWith((ref) => false),
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
    expect(find.text('Success rate'), findsNothing);
    expect(find.text('Avg confirmation'), findsNothing);
    expect(find.text('Avg Confirmation'), findsNothing);
  });

  testWidgets('login form signs in with mock credentials', (tester) async {
    SharedPreferences.setMockInitialValues({});
    await authController.logout();

    await tester.pumpWidget(
      MaterialApp.router(
        routerConfig: GoRouter(
          refreshListenable: authController,
          redirect: (context, state) {
            final loggingIn = state.matchedLocation == '/login' ||
                state.matchedLocation == '/signup';
            if (!authController.isAuthenticated && !loggingIn) return '/login';
            if (authController.isAuthenticated && loggingIn) return '/';
            return null;
          },
          routes: [
            GoRoute(path: '/login', builder: (context, state) => const LoginScreen()),
            GoRoute(path: '/signup', builder: (context, state) => const SignupScreen()),
            GoRoute(
              path: '/',
              builder: (context, state) => const Scaffold(body: Text('Merchant dashboard')),
            ),
          ],
        ),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('Sign in to your merchant dashboard'), findsOneWidget);
    await tester.enterText(find.byType(TextField).first, 'merchant@sandbox.test');
    await tester.enterText(find.byType(TextField).last, 'sandbox123');
    await tester.tap(find.text('Sign in'));
    await tester.pumpAndSettle();

    expect(find.text('Merchant dashboard'), findsOneWidget);
  });

  testWidgets('signup form creates a mock merchant session', (tester) async {
    SharedPreferences.setMockInitialValues({});
    await authController.logout();

    await tester.pumpWidget(
      MaterialApp.router(
        routerConfig: GoRouter(
          refreshListenable: authController,
          redirect: (context, state) {
            final loggingIn = state.matchedLocation == '/login' ||
                state.matchedLocation == '/signup';
            if (!authController.isAuthenticated && !loggingIn) return '/login';
            if (authController.isAuthenticated && loggingIn) return '/';
            return null;
          },
          routes: [
            GoRoute(path: '/login', builder: (context, state) => const LoginScreen()),
            GoRoute(path: '/signup', builder: (context, state) => const SignupScreen()),
            GoRoute(
              path: '/',
              builder: (context, state) => const Scaffold(body: Text('Merchant dashboard')),
            ),
          ],
        ),
      ),
    );
    await tester.pumpAndSettle();

    await tester.tap(find.text('Create a merchant account'));
    await tester.pumpAndSettle();

    expect(find.text('Create a merchant account'), findsWidgets);
    final fields = find.byType(TextField);
    await tester.enterText(fields.at(0), 'Sandbox Shop');
    await tester.enterText(fields.at(1), 'shop@sandbox.test');
    await tester.enterText(fields.at(2), 'sandbox123');
    await tester.enterText(fields.at(3), 'sandbox123');
    await tester.tap(find.text('Sign up'));
    await tester.pumpAndSettle();

    expect(find.text('Merchant dashboard'), findsOneWidget);
  });
}

class _LiveMode extends MerchantModeController {
  @override
  MerchantMode build() => MerchantMode.live;
}
