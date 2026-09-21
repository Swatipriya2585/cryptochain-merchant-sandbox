import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../providers/merchant_mode_controller.dart';
import '../providers/payments_providers.dart';
import '../sandbox/models.dart';
import '../sandbox/store.dart';
import '../widgets/error_panel.dart';
import '../widgets/sparkline.dart';

class DashboardHomeScreen extends ConsumerWidget {
  const DashboardHomeScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final sandbox = ref.watch(isSandboxProvider);
    if (sandbox) {
      final state = ref.watch(sandboxStoreProvider);
      return _DashboardScaffold(
        onRefresh: () async {},
        child: _DashboardBody(
          snapshot: _DashboardViewData.sandbox(state),
        ),
      );
    }

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
            child: _DashboardBody(snapshot: _DashboardViewData.live(data)),
          );
        },
      ),
    );
  }
}

class _DashboardScaffold extends StatelessWidget {
  const _DashboardScaffold({required this.child, required this.onRefresh});

  final Widget child;
  final Future<void> Function() onRefresh;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Dashboard')),
      body: RefreshIndicator(onRefresh: onRefresh, child: child),
    );
  }
}

class _DashboardViewData {
  const _DashboardViewData({
    required this.networkLabel,
    required this.confirmedVolume,
    required this.pendingCount,
    required this.successRateLabel,
    required this.successSubtitle,
    required this.avgConfirmationLabel,
    required this.portfolioLabel,
    required this.todayPaymentsLabel,
    required this.monthlyVolumeLabel,
    required this.feesSavedLabel,
    required this.avgConfirmationCardLabel,
    required this.todaySpark,
    required this.monthlySpark,
    required this.successSpark,
    required this.pendingSettlements,
    required this.showImportBanner,
    required this.sandboxNotice,
    required this.totalPaymentIntents,
  });

  factory _DashboardViewData.live(dynamic data) {
    return _DashboardViewData(
      networkLabel: '${data.network} · ${data.totalPaymentIntents} payments',
      confirmedVolume: '${data.totalConfirmedVolumeCrypto} ${data.currencyCrypto}',
      pendingCount: '${data.pendingCount}',
      successRateLabel: '${data.successRatePercent.toStringAsFixed(1)}%',
      successSubtitle: '${data.confirmedCount} of ${data.totalPaymentIntents} payments',
      avgConfirmationLabel: data.avgConfirmationTimeSeconds == null
          ? null
          : _formatDuration(data.avgConfirmationTimeSeconds as int),
      portfolioLabel: 'Unavailable',
      todayPaymentsLabel: 'Unavailable',
      monthlyVolumeLabel: 'Unavailable',
      feesSavedLabel: 'Unavailable — no metric in backend',
      avgConfirmationCardLabel: data.avgConfirmationTimeSeconds == null
          ? 'Unavailable — no metric in backend'
          : _formatDuration(data.avgConfirmationTimeSeconds as int),
      todaySpark: const [],
      monthlySpark: const [],
      successSpark: const [],
      pendingSettlements: const <LedgerEntry>[],
      showImportBanner: true,
      sandboxNotice: false,
      totalPaymentIntents: data.totalPaymentIntents as int,
    );
  }

  factory _DashboardViewData.sandbox(SandboxState state) {
    final metrics = state.metrics;
    final pending = state.settlements.where((item) => item.status == 'pending').toList();
    return _DashboardViewData(
      networkLabel: 'sandbox · ${metrics.totalPaymentIntents} payments',
      confirmedVolume: '${metrics.confirmedVolumeCrypto} ${metrics.currencyCrypto}',
      pendingCount: '${metrics.pendingCount}',
      successRateLabel: '${metrics.successRatePercent.toStringAsFixed(1)}%',
      successSubtitle: '${metrics.confirmedCount} of ${metrics.totalPaymentIntents} payments',
      avgConfirmationLabel: '${metrics.avgConfirmationSeconds.toStringAsFixed(1)}s',
      portfolioLabel: formatUsd(metrics.portfolioUsd),
      todayPaymentsLabel: formatUsd(metrics.todayPaymentsUsd),
      monthlyVolumeLabel: formatUsd(metrics.monthlyVolumeUsd),
      feesSavedLabel: formatUsd(metrics.feesSavedUsd),
      avgConfirmationCardLabel: '${metrics.avgConfirmationSeconds.toStringAsFixed(1)}s',
      todaySpark: metrics.todaySparkline,
      monthlySpark: metrics.monthlySparkline,
      successSpark: metrics.successSparkline,
      pendingSettlements: pending,
      showImportBanner: false,
      sandboxNotice: true,
      totalPaymentIntents: metrics.totalPaymentIntents,
    );
  }

  final String networkLabel;
  final String confirmedVolume;
  final String pendingCount;
  final String successRateLabel;
  final String successSubtitle;
  final String? avgConfirmationLabel;
  final String portfolioLabel;
  final String todayPaymentsLabel;
  final String monthlyVolumeLabel;
  final String feesSavedLabel;
  final String avgConfirmationCardLabel;
  final List<double> todaySpark;
  final List<double> monthlySpark;
  final List<double> successSpark;
  final List<LedgerEntry> pendingSettlements;
  final bool showImportBanner;
  final bool sandboxNotice;
  final int totalPaymentIntents;

  static String _formatDuration(int seconds) {
    if (seconds < 60) return '${seconds}s';
    final minutes = seconds ~/ 60;
    final rest = seconds % 60;
    return rest == 0 ? '${minutes}m' : '${minutes}m ${rest}s';
  }
}

class _DashboardBody extends StatelessWidget {
  const _DashboardBody({required this.snapshot});

  final _DashboardViewData snapshot;

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      physics: const AlwaysScrollableScrollPhysics(),
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
        if (snapshot.showImportBanner)
          const _InfoBanner(
            color: Color(0xFFE3F2FD),
            text: 'Import your real wallet address to receive mainnet payments',
          ),
        if (snapshot.sandboxNotice)
          const _InfoBanner(
            color: Color(0xFFFFF3E0),
            text: "You're in Sandbox Mode — all data shown is simulated.",
          ),
        Text(
          'Welcome back',
          style: Theme.of(context).textTheme.headlineSmall?.copyWith(
            fontWeight: FontWeight.w700,
          ),
        ),
        const SizedBox(height: 4),
        Text(
          snapshot.networkLabel,
          style: Theme.of(context).textTheme.bodyMedium?.copyWith(
            color: Theme.of(context).colorScheme.onSurfaceVariant,
          ),
        ),
        const SizedBox(height: 16),
        _StatCard(
          title: 'Total confirmed',
          value: snapshot.confirmedVolume,
          subtitle: snapshot.sandboxNotice
              ? '${snapshot.successSubtitle} (simulated)'
              : '${snapshot.successSubtitle.split(' of ').first} confirmed on Sepolia',
          icon: Icons.verified_outlined,
        ),
        _StatCard(
          title: 'Pending',
          value: snapshot.pendingCount,
          subtitle: 'Waiting for on-chain confirmation',
          icon: Icons.hourglass_top_outlined,
        ),
        _StatCard(
          title: 'Success rate',
          value: snapshot.successRateLabel,
          subtitle: snapshot.successSubtitle,
          icon: Icons.trending_up,
        ),
        if (snapshot.avgConfirmationLabel != null)
          _StatCard(
            title: 'Avg confirmation',
            value: snapshot.avgConfirmationLabel!,
            subtitle: 'Time from created to confirmed',
            icon: Icons.timer_outlined,
          ),
        _MetricCard(
          title: 'Wallet portfolio balance',
          value: snapshot.portfolioLabel,
          subtitle: snapshot.sandboxNotice ? 'Simulated multi-chain total' : 'Live chain balance is not wired',
        ),
        _MetricCard(
          title: "Today's Payments",
          value: snapshot.todayPaymentsLabel,
          subtitle: 'Volume received today',
          sparkline: snapshot.todaySpark,
        ),
        _MetricCard(
          title: 'Monthly Volume',
          value: snapshot.monthlyVolumeLabel,
          subtitle: 'Trailing 30 days',
          sparkline: snapshot.monthlySpark,
        ),
        if (snapshot.successSpark.isNotEmpty)
          _MetricCard(
            title: 'Success Rate trend',
            value: snapshot.successRateLabel,
            subtitle: snapshot.successSubtitle,
            sparkline: snapshot.successSpark,
          ),
        _MetricCard(
          title: 'Fees Saved',
          value: snapshot.feesSavedLabel,
          subtitle: snapshot.sandboxNotice
              ? 'Versus unoptimized routing'
              : 'Not exposed by the live summary API',
        ),
        _MetricCard(
          title: 'Avg Confirmation',
          value: snapshot.avgConfirmationCardLabel,
          subtitle: 'Time from created to confirmed',
        ),
        const SizedBox(height: 8),
        Text('Pending Settlements', style: Theme.of(context).textTheme.titleMedium),
        const SizedBox(height: 8),
        if (snapshot.pendingSettlements.isEmpty)
          const Text('No pending settlements.')
        else
          for (final item in snapshot.pendingSettlements.take(3))
            Card(
              child: ListTile(
                title: Text(item.title),
                subtitle: Text(item.subtitle),
                trailing: Text(formatUsd(item.amountUsd)),
              ),
            ),
        const SizedBox(height: 16),
        FilledButton.icon(
          onPressed: () => context.go('/payments/new'),
          icon: const Icon(Icons.add),
          label: const Text('New payment'),
        ),
        ],
      ),
    );
  }
}

class _InfoBanner extends StatelessWidget {
  const _InfoBanner({required this.color, required this.text});

  final Color color;
  final String text;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: color,
        borderRadius: BorderRadius.circular(12),
      ),
      child: Text(text, style: Theme.of(context).textTheme.bodyMedium),
    );
  }
}

class _MetricCard extends StatelessWidget {
  const _MetricCard({
    required this.title,
    required this.value,
    required this.subtitle,
    this.sparkline = const [],
  });

  final String title;
  final String value;
  final String subtitle;
  final List<double> sparkline;

  @override
  Widget build(BuildContext context) {
    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      child: Padding(
        padding: const EdgeInsets.all(16),
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
            Text(subtitle, style: Theme.of(context).textTheme.bodySmall),
            if (sparkline.isNotEmpty) ...[
              const SizedBox(height: 8),
              Sparkline(values: sparkline),
            ],
          ],
        ),
      ),
    );
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
