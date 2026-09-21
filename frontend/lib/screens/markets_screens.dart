import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../providers/merchant_mode_controller.dart';
import '../sandbox/models.dart';
import '../sandbox/store.dart';
import '../widgets/sparkline.dart';

class AnalyticsScreen extends ConsumerWidget {
  const AnalyticsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final sandbox = ref.watch(isSandboxProvider);
    final metrics = ref.watch(sandboxStoreProvider).metrics;
    return Scaffold(
      appBar: AppBar(title: const Text('Analytics')),
      body: !sandbox
          ? const Center(child: Text('Analytics charts use sandbox mock series.'))
          : ListView(
              padding: const EdgeInsets.all(16),
              children: [
                _ChartCard(title: 'Payments today', value: formatUsd(metrics.todayPaymentsUsd), series: metrics.todaySparkline),
                _ChartCard(title: 'Monthly volume', value: formatUsd(metrics.monthlyVolumeUsd), series: metrics.monthlySparkline),
                _ChartCard(title: 'Success rate', value: '${metrics.successRatePercent}%', series: metrics.successSparkline),
              ],
            ),
    );
  }
}

class CoinsScreen extends ConsumerWidget {
  const CoinsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final coins = ref.watch(sandboxStoreProvider).coins;
    return Scaffold(
      appBar: AppBar(title: const Text('Coins')),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          const Text(
            'Mock session prices — not live market feeds, so sandbox stays isolated from live services.',
          ),
          const SizedBox(height: 12),
          for (final coin in coins)
            Card(
              child: ListTile(
                title: Text('${coin.name} (${coin.symbol})'),
                subtitle: Sparkline(values: coin.sparkline, height: 28),
                trailing: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  crossAxisAlignment: CrossAxisAlignment.end,
                  children: [
                    Text(formatUsd(coin.usdPrice)),
                    Text('${coin.changePercent.toStringAsFixed(1)}%'),
                  ],
                ),
              ),
            ),
        ],
      ),
    );
  }
}

class ConverterScreen extends ConsumerStatefulWidget {
  const ConverterScreen({super.key});

  @override
  ConsumerState<ConverterScreen> createState() => _ConverterScreenState();
}

class _ConverterScreenState extends ConsumerState<ConverterScreen> {
  String _from = 'ETH';
  String _to = 'USDC';
  final _amount = TextEditingController(text: '1');

  @override
  void dispose() {
    _amount.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final coins = ref.watch(sandboxStoreProvider).coins;
    final from = coins.firstWhere((c) => c.symbol == _from, orElse: () => coins.first);
    final to = coins.firstWhere((c) => c.symbol == _to, orElse: () => coins.last);
    final amount = double.tryParse(_amount.text) ?? 0;
    final out = amount * from.usdPrice / to.usdPrice;

    return Scaffold(
      appBar: AppBar(title: const Text('Converter')),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          TextField(
            controller: _amount,
            keyboardType: const TextInputType.numberWithOptions(decimal: true),
            decoration: const InputDecoration(labelText: 'Amount', border: OutlineInputBorder()),
            onChanged: (_) => setState(() {}),
          ),
          const SizedBox(height: 12),
          DropdownButtonFormField<String>(
            initialValue: _from,
            items: [for (final coin in coins) DropdownMenuItem(value: coin.symbol, child: Text(coin.symbol))],
            onChanged: (value) => setState(() => _from = value ?? _from),
          ),
          DropdownButtonFormField<String>(
            initialValue: _to,
            items: [for (final coin in coins) DropdownMenuItem(value: coin.symbol, child: Text(coin.symbol))],
            onChanged: (value) => setState(() => _to = value ?? _to),
          ),
          const SizedBox(height: 16),
          Text('= ${out.toStringAsFixed(6)} $_to', style: Theme.of(context).textTheme.headlineSmall),
        ],
      ),
    );
  }
}

class TokenOfDayScreen extends ConsumerWidget {
  const TokenOfDayScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final state = ref.watch(sandboxStoreProvider);
    final coin = state.coins.firstWhere((c) => c.symbol == state.tokenOfDaySymbol);
    return Scaffold(
      appBar: AppBar(title: const Text('Token of Day')),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Text(coin.name, style: Theme.of(context).textTheme.headlineMedium),
          Text(formatUsd(coin.usdPrice), style: Theme.of(context).textTheme.headlineSmall),
          const SizedBox(height: 12),
          Sparkline(values: coin.sparkline, height: 64),
          const SizedBox(height: 12),
          Text('Session highlight token. Price is mocked with the rest of sandbox market data.'),
        ],
      ),
    );
  }
}

class SwapScreen extends ConsumerStatefulWidget {
  const SwapScreen({super.key});

  @override
  ConsumerState<SwapScreen> createState() => _SwapScreenState();
}

class _SwapScreenState extends ConsumerState<SwapScreen> {
  String? _walletId;
  String _from = 'USDC';
  String _to = 'ETH';
  final _amount = TextEditingController(text: '25');
  String? _result;

  @override
  void dispose() {
    _amount.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final sandbox = ref.watch(isSandboxProvider);
    final state = ref.watch(sandboxStoreProvider);
    _walletId ??= state.wallets.firstOrNull?.id;

    return Scaffold(
      appBar: AppBar(title: const Text('Swap')),
      body: !sandbox
          ? const Center(child: Text('Swaps are mocked in SANDBOX only (no Uniswap/Jupiter calls).'))
          : ListView(
              padding: const EdgeInsets.all(16),
              children: [
                DropdownButtonFormField<String>(
                  initialValue: _walletId,
                  items: [
                    for (final wallet in state.wallets)
                      DropdownMenuItem(value: wallet.id, child: Text(wallet.name)),
                  ],
                  onChanged: (value) => setState(() => _walletId = value),
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: _amount,
                  decoration: const InputDecoration(labelText: 'Amount', border: OutlineInputBorder()),
                ),
                DropdownButtonFormField<String>(
                  initialValue: _from,
                  items: const [
                    DropdownMenuItem(value: 'USDC', child: Text('USDC')),
                    DropdownMenuItem(value: 'ETH', child: Text('ETH')),
                    DropdownMenuItem(value: 'SOL', child: Text('SOL')),
                  ],
                  onChanged: (value) => setState(() => _from = value ?? _from),
                ),
                DropdownButtonFormField<String>(
                  initialValue: _to,
                  items: const [
                    DropdownMenuItem(value: 'ETH', child: Text('ETH')),
                    DropdownMenuItem(value: 'USDC', child: Text('USDC')),
                    DropdownMenuItem(value: 'SOL', child: Text('SOL')),
                  ],
                  onChanged: (value) => setState(() => _to = value ?? _to),
                ),
                const SizedBox(height: 16),
                FilledButton(
                  onPressed: () async {
                    final amount = double.tryParse(_amount.text) ?? 0;
                    if (_walletId == null || amount <= 0) return;
                    await ref.read(sandboxStoreProvider.notifier).mockSwap(
                      walletId: _walletId!,
                      fromSymbol: _from,
                      toSymbol: _to,
                      amount: amount,
                    );
                    setState(() => _result = 'Swapped $amount $_from → $_to (simulated)');
                  },
                  child: const Text('Swap (simulated)'),
                ),
                if (_result != null) ...[
                  const SizedBox(height: 12),
                  Text(_result!),
                ],
              ],
            ),
    );
  }
}

class RevenueScreen extends ConsumerWidget {
  const RevenueScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final sandbox = ref.watch(isSandboxProvider);
    final metrics = ref.watch(sandboxStoreProvider).metrics;
    return Scaffold(
      appBar: AppBar(title: const Text('Revenue')),
      body: !sandbox
          ? const Center(child: Text('Revenue uses sandbox mock volume.'))
          : ListView(
              padding: const EdgeInsets.all(16),
              children: [
                Text(formatUsd(metrics.monthlyVolumeUsd), style: Theme.of(context).textTheme.headlineMedium),
                const Text('Simulated monthly revenue'),
                const SizedBox(height: 16),
                Sparkline(values: metrics.monthlySparkline, height: 72),
                const SizedBox(height: 16),
                Text('Fees saved ${formatUsd(metrics.feesSavedUsd)}'),
              ],
            ),
    );
  }
}

class _ChartCard extends StatelessWidget {
  const _ChartCard({required this.title, required this.value, required this.series});

  final String title;
  final String value;
  final List<double> series;

  @override
  Widget build(BuildContext context) {
    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(title),
            Text(value, style: Theme.of(context).textTheme.headlineSmall),
            Sparkline(values: series),
          ],
        ),
      ),
    );
  }
}
