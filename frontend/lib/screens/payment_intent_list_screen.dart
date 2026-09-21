import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../data/models/payment_intent.dart';
import '../providers/merchant_mode_controller.dart';
import '../providers/payments_providers.dart';
import '../sandbox/merchant_mode.dart';
import '../widgets/error_panel.dart';
import '../widgets/status_chip.dart';

class PaymentIntentListScreen extends ConsumerWidget {
  const PaymentIntentListScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final query = ref.watch(paymentListQueryProvider);
    final list = ref.watch(paymentListProvider);

    return Scaffold(
      appBar: AppBar(title: const Text('Payments')),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () => context.go('/payments/new'),
        icon: const Icon(Icons.add),
        label: const Text('New'),
      ),
      body: Column(
        children: [
          SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            padding: const EdgeInsets.fromLTRB(12, 8, 12, 4),
            child: Row(
              children: [
                _FilterChip(
                  label: 'All',
                  selected: query.status == null,
                  onSelected: () => ref.read(paymentListQueryProvider.notifier).setStatus(null),
                ),
                for (final status in PaymentStatus.values)
                  _FilterChip(
                    label: status.label,
                    selected: query.status == status,
                    onSelected: () =>
                        ref.read(paymentListQueryProvider.notifier).setStatus(status),
                  ),
              ],
            ),
          ),
          Expanded(
            child: list.when(
              loading: () => const Center(child: CircularProgressIndicator()),
              error: (error, _) => ErrorPanel(
                error: error,
                onRetry: () => ref.invalidate(paymentListProvider),
                onUseSandbox: () =>
                    ref.read(merchantModeProvider.notifier).setMode(MerchantMode.sandbox),
              ),
              data: (page) {
                if (page.items.isEmpty) {
                  return const Center(child: Text('No payments match this filter.'));
                }
                return RefreshIndicator(
                  onRefresh: () async => ref.refresh(paymentListProvider.future),
                  child: ListView.separated(
                    padding: const EdgeInsets.fromLTRB(12, 8, 12, 88),
                    itemCount: page.items.length,
                    separatorBuilder: (_, _) => const SizedBox(height: 4),
                    itemBuilder: (context, index) {
                      final intent = page.items[index];
                      return Card(
                        child: ListTile(
                          title: Text(
                            '${intent.amountRequestedCrypto} ${intent.currencyCrypto}',
                          ),
                          subtitle: Text(intent.reference),
                          trailing: StatusChip(status: intent.status),
                          onTap: () => context.go('/payments/${intent.id}'),
                        ),
                      );
                    },
                  ),
                );
              },
            ),
          ),
        ],
      ),
    );
  }
}

class _FilterChip extends StatelessWidget {
  const _FilterChip({
    required this.label,
    required this.selected,
    required this.onSelected,
  });

  final String label;
  final bool selected;
  final VoidCallback onSelected;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(right: 8),
      child: FilterChip(
        label: Text(label),
        selected: selected,
        onSelected: (_) => onSelected(),
      ),
    );
  }
}
