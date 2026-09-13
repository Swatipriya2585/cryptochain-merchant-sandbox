import 'package:go_router/go_router.dart';

import 'screens/dashboard_home_screen.dart';
import 'screens/payment_intent_create_screen.dart';
import 'screens/payment_intent_detail_screen.dart';
import 'screens/payment_intent_list_screen.dart';
import 'screens/settings_screen.dart';
import 'widgets/app_shell.dart';

final appRouter = GoRouter(
  routes: [
    ShellRoute(
      builder: (context, state, child) => AppShell(child: child),
      routes: [
        GoRoute(
          path: '/',
          name: 'dashboard',
          builder: (context, state) => const DashboardHomeScreen(),
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
          path: '/settings',
          name: 'settings',
          builder: (context, state) => const SettingsScreen(),
        ),
      ],
    ),
  ],
);
