import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../providers/payments_providers.dart';
import '../widgets/error_panel.dart';

class DashboardHomeScreen extends ConsumerWidget {
  const DashboardHomeScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final summary = ref.watch(summaryProvider);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Dashboard'),
        actions: [
          IconButton(
            tooltip: 'Refresh',
            onPressed: () => ref.invalidate(summaryProvider),
            icon: const Icon(Icons.refresh),
          ),
        ],
      ),
      body: summary.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (error, _) => ErrorPanel(
          error: error,
          onRetry: () => ref.invalidate(summaryProvider),
        ),
        data: (data) {
          return RefreshIndicator(
            onRefresh: () async => ref.refresh(summaryProvider.future),
            child: ListView(
              padding: const EdgeInsets.all(16),
              children: [
                Text(
                  'Welcome back',
                  style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                    fontWeight: FontWeight.w700,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  '${data.network} · ${data.totalPaymentIntents} payments',
                  style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                    color: Theme.of(context).colorScheme.onSurfaceVariant,
                  ),
                ),
                const SizedBox(height: 16),
                _StatCard(
                  title: 'Total confirmed',
                  value: '${data.totalConfirmedVolumeCrypto} ${data.currencyCrypto}',
                  subtitle: '${data.confirmedCount} confirmed on Sepolia',
                  icon: Icons.verified_outlined,
                ),
                _StatCard(
                  title: 'Pending',
                  value: '${data.pendingCount}',
                  subtitle: 'Waiting for on-chain confirmation',
                  icon: Icons.hourglass_top_outlined,
                ),
                _StatCard(
                  title: 'Success rate',
                  value: '${data.successRatePercent.toStringAsFixed(1)}%',
                  subtitle: '${data.confirmedCount} of ${data.totalPaymentIntents} payments',
                  icon: Icons.trending_up,
                ),
                if (data.avgConfirmationTimeSeconds != null)
                  _StatCard(
                    title: 'Avg confirmation',
                    value: _formatDuration(data.avgConfirmationTimeSeconds!),
                    subtitle: 'Time from created to confirmed',
                    icon: Icons.timer_outlined,
                  ),
                const SizedBox(height: 8),
                FilledButton.icon(
                  onPressed: () => context.go('/payments/new'),
                  icon: const Icon(Icons.add),
                  label: const Text('New payment'),
                ),
              ],
            ),
          );
        },
      ),
    );
  }

  static String _formatDuration(int seconds) {
    if (seconds < 60) return '${seconds}s';
    final minutes = seconds ~/ 60;
    final rest = seconds % 60;
    return rest == 0 ? '${minutes}m' : '${minutes}m ${rest}s';
  }
}

class _StatCard extends StatelessWidget {
  const _StatCard({
    required this.title,
    required this.value,
    required this.subtitle,
    required this.icon,
  });

  final String title;
  final String value;
  final String subtitle;
  final IconData icon;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Row(
          children: [
            CircleAvatar(
              backgroundColor: scheme.primaryContainer,
              foregroundColor: scheme.onPrimaryContainer,
              child: Icon(icon),
            ),
            const SizedBox(width: 16),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(title, style: Theme.of(context).textTheme.labelLarge),
                  const SizedBox(height: 4),
                  Text(
                    value,
                    style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                  Text(
                    subtitle,
                    style: Theme.of(context).textTheme.bodySmall?.copyWith(
                      color: scheme.onSurfaceVariant,
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
