import 'package:go_router/go_router.dart';

import 'providers/auth_controller.dart';
import 'screens/dashboard_home_screen.dart';
import 'screens/developers_screen.dart';
import 'screens/ledger_screens.dart';
import 'screens/login_screen.dart';
import 'screens/markets_screens.dart';
import 'screens/payment_intent_create_screen.dart';
import 'screens/payment_intent_detail_screen.dart';
import 'screens/payment_intent_list_screen.dart';
import 'screens/settings_screen.dart';
import 'screens/signup_screen.dart';
import 'screens/smart_send_screen.dart';
import 'screens/wallets_screen.dart';
import 'widgets/app_shell.dart';

final appRouter = GoRouter(
  refreshListenable: authController,
  redirect: (context, state) {
    final loggingIn =
        state.matchedLocation == '/login' || state.matchedLocation == '/signup';
    if (!authController.isAuthenticated && !loggingIn) return '/login';
    if (authController.isAuthenticated && loggingIn) return '/';
    return null;
  },
  routes: [
    GoRoute(
      path: '/login',
      name: 'login',
      builder: (context, state) => const LoginScreen(),
    ),
    GoRoute(
      path: '/signup',
      name: 'signup',
      builder: (context, state) => const SignupScreen(),
    ),
    ShellRoute(
      builder: (context, state, child) => AppShell(child: child),
      routes: [
        GoRoute(
          path: '/',
          name: 'dashboard',
          builder: (context, state) => const DashboardHomeScreen(),
        ),
        GoRoute(
          path: '/wallets',
          name: 'wallets',
          builder: (context, state) => const WalletsScreen(),
        ),
        GoRoute(
          path: '/smart-send',
          name: 'smart-send',
          builder: (context, state) => const SmartSendScreen(),
        ),
        GoRoute(
          path: '/payments',
          name: 'payments',
          builder: (context, state) => const PaymentIntentListScreen(),
        ),
        GoRoute(
          path: '/payments/new',
          name: 'payment-create',
          builder: (context, state) => const PaymentIntentCreateScreen(),
        ),
        GoRoute(
          path: '/payments/:id',
          name: 'payment-detail',
          builder: (context, state) => PaymentIntentDetailScreen(
            paymentIntentId: state.pathParameters['id']!,
          ),
        ),
        GoRoute(
          path: '/transactions',
          builder: (context, state) => const TransactionsScreen(),
        ),
        GoRoute(
          path: '/invoices',
          builder: (context, state) => const InvoicesScreen(),
        ),
        GoRoute(
          path: '/customers',
          builder: (context, state) => const CustomersScreen(),
        ),
        GoRoute(
          path: '/settlements',
          builder: (context, state) => const SettlementsScreen(),
        ),
        GoRoute(
          path: '/analytics',
          builder: (context, state) => const AnalyticsScreen(),
        ),
        GoRoute(
          path: '/coins',
          builder: (context, state) => const CoinsScreen(),
        ),
        GoRoute(
          path: '/converter',
          builder: (context, state) => const ConverterScreen(),
        ),
        GoRoute(
          path: '/token-of-day',
          builder: (context, state) => const TokenOfDayScreen(),
        ),
        GoRoute(
          path: '/swap',
          builder: (context, state) => const SwapScreen(),
        ),
        GoRoute(
          path: '/revenue',
          builder: (context, state) => const RevenueScreen(),
        ),
        GoRoute(
          path: '/developers',
          builder: (context, state) => const DevelopersScreen(),
        ),
        GoRoute(
          path: '/settings',
          name: 'settings',
          builder: (context, state) => const SettingsScreen(),
        ),
      ],
    ),
  ],
);
