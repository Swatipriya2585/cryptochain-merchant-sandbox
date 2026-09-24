import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../providers/merchant_mode_controller.dart';
import '../sandbox/models.dart';
import '../sandbox/store.dart';

class TransactionsScreen extends ConsumerWidget {
  const TransactionsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return _LedgerList(
      title: 'Transactions',
      emptyLive: 'No live transactions. Switch to SANDBOX to explore sample history.',
      items: ref.watch(isSandboxProvider) ? ref.watch(sandboxStoreProvider).transactions : const [],
    );
  }
}

class SettlementsScreen extends ConsumerWidget {
  const SettlementsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final sandbox = ref.watch(isSandboxProvider);
    final items = sandbox ? ref.watch(sandboxStoreProvider).settlements : const <LedgerEntry>[];
    return Scaffold(
      appBar: AppBar(title: const Text('Settlements')),
      body: !sandbox
          ? const Center(child: Text('No live settlements loaded.'))
          : ListView(
              padding: const EdgeInsets.all(16),
              children: [
                for (final item in items)
                  Card(
                    child: ListTile(
                      title: Text(item.title),
                      subtitle: Text(
                        [
                          item.subtitle,
                          formatTimestamp(item.createdAt),
                          if (item.status.toLowerCase() != 'pending') item.status,
                        ].join(' · '),
                      ),
                      trailing: Text(formatUsd(item.amountUsd)),
                      onTap: () => _showSettlementDetails(context, item),
                    ),
                  ),
              ],
            ),
    );
  }
}

class InvoicesScreen extends ConsumerWidget {
  const InvoicesScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final sandbox = ref.watch(isSandboxProvider);
    final items = sandbox ? ref.watch(sandboxStoreProvider).invoices : const <LedgerEntry>[];
    return Scaffold(
      appBar: AppBar(title: const Text('Invoices')),
      floatingActionButton: sandbox
          ? FloatingActionButton.extended(
              onPressed: () => _editInvoice(context, ref),
              icon: const Icon(Icons.add),
              label: const Text('Create invoice'),
            )
          : null,
      body: !sandbox
          ? const Center(child: Text('Invoice CRUD is available in SANDBOX.'))
          : ListView(
              padding: const EdgeInsets.fromLTRB(16, 16, 16, 88),
              children: [
                for (final item in items)
                  Card(
                    child: ListTile(
                      title: Text(item.title),
                      subtitle: Text('${item.subtitle} · ${item.status}'),
                      trailing: Text(formatUsd(item.amountUsd)),
                      onTap: () => _editInvoice(context, ref, existing: item),
                      onLongPress: () =>
                          ref.read(sandboxStoreProvider.notifier).deleteInvoice(item.id),
                    ),
                  ),
              ],
            ),
    );
  }
}

class CustomersScreen extends ConsumerWidget {
  const CustomersScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final sandbox = ref.watch(isSandboxProvider);
    final items = sandbox ? ref.watch(sandboxStoreProvider).customers : const <SandboxCustomer>[];
    return Scaffold(
      appBar: AppBar(title: const Text('Customers')),
      floatingActionButton: sandbox
          ? FloatingActionButton.extended(
              onPressed: () => _editCustomer(context, ref),
              icon: const Icon(Icons.add),
              label: const Text('Add customer'),
            )
          : null,
      body: !sandbox
          ? const Center(child: Text('Customer CRUD is available in SANDBOX.'))
          : ListView(
              padding: const EdgeInsets.fromLTRB(16, 16, 16, 88),
              children: [
                for (final item in items)
                  Card(
                    child: ListTile(
                      title: Text(item.name),
                      subtitle: Text(item.email),
                      onTap: () => _editCustomer(context, ref, existing: item),
                      onLongPress: () =>
                          ref.read(sandboxStoreProvider.notifier).deleteCustomer(item.id),
                    ),
                  ),
              ],
            ),
    );
  }
}

class _LedgerList extends ConsumerWidget {
  const _LedgerList({
    required this.title,
    required this.emptyLive,
    required this.items,
  });

  final String title;
  final String emptyLive;
  final List<LedgerEntry> items;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final sandbox = ref.watch(isSandboxProvider);
    return Scaffold(
      appBar: AppBar(title: Text(title)),
      body: !sandbox
          ? Center(child: Text(emptyLive))
          : ListView(
              padding: const EdgeInsets.all(16),
              children: [
                for (final item in items)
                  Card(
                    child: ListTile(
                      title: Text(item.title),
                      subtitle: Text(
                        [
                          item.subtitle,
                          if (item.txHash != null) item.txHash!,
                          item.status,
                        ].join(' · '),
                      ),
                      trailing: Text(formatUsd(item.amountUsd)),
                    ),
                  ),
              ],
            ),
    );
  }
}

Future<void> _showSettlementDetails(BuildContext context, LedgerEntry item) async {
  await showDialog<void>(
    context: context,
    builder: (context) => AlertDialog(
      title: Text(item.title),
      content: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(item.subtitle),
          const SizedBox(height: 8),
          Text('Amount: ${formatUsd(item.amountUsd)}'),
          Text('Date: ${formatDate(item.createdAt)}'),
          Text('Time: ${formatTime(item.createdAt)}'),
          if (item.counterparty != null) Text('Counterparty: ${item.counterparty}'),
          if (item.txHash != null) SelectableText('Tx: ${item.txHash}'),
        ],
      ),
      actions: [
        FilledButton(
          onPressed: () => Navigator.pop(context),
          child: const Text('Close'),
        ),
      ],
    ),
  );
}

Future<void> _editInvoice(BuildContext context, WidgetRef ref, {LedgerEntry? existing}) async {
  final title = TextEditingController(text: existing?.title ?? 'INV-NEW');
  final amount = TextEditingController(text: existing?.amountUsd.toString() ?? '120');
  final status = existing?.status ?? 'open';
  var currentStatus = status;
  await showDialog<void>(
    context: context,
    builder: (context) {
      return AlertDialog(
        title: Text(existing == null ? 'Create invoice' : 'Edit invoice'),
        content: StatefulBuilder(
          builder: (context, setLocal) {
            return Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                TextField(controller: title, decoration: const InputDecoration(labelText: 'Number')),
                TextField(
                  controller: amount,
                  decoration: const InputDecoration(labelText: 'Amount USD'),
                  keyboardType: const TextInputType.numberWithOptions(decimal: true),
                ),
                DropdownButtonFormField<String>(
                  initialValue: currentStatus,
                  items: const [
                    DropdownMenuItem(value: 'draft', child: Text('draft')),
                    DropdownMenuItem(value: 'open', child: Text('open')),
                    DropdownMenuItem(value: 'paid', child: Text('paid')),
                    DropdownMenuItem(value: 'overdue', child: Text('overdue')),
                  ],
                  onChanged: (value) => setLocal(() => currentStatus = value ?? currentStatus),
                ),
              ],
            );
          },
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context), child: const Text('Cancel')),
          FilledButton(
            onPressed: () async {
              await ref.read(sandboxStoreProvider.notifier).upsertInvoice(
                LedgerEntry(
                  id: existing?.id ?? 'sbx_inv_${DateTime.now().microsecondsSinceEpoch}',
                  title: title.text,
                  subtitle: existing?.subtitle ?? 'Sandbox customer',
                  amountUsd: double.tryParse(amount.text) ?? 0,
                  status: currentStatus,
                  createdAt: existing?.createdAt ?? DateTime.now(),
                  counterparty: existing?.counterparty,
                ),
              );
              if (context.mounted) Navigator.pop(context);
            },
            child: const Text('Save'),
          ),
        ],
      );
    },
  );
}

Future<void> _editCustomer(
  BuildContext context,
  WidgetRef ref, {
  SandboxCustomer? existing,
}) async {
  final name = TextEditingController(text: existing?.name ?? '');
  final email = TextEditingController(text: existing?.email ?? '');
  await showDialog<void>(
    context: context,
    builder: (context) => AlertDialog(
      title: Text(existing == null ? 'Add customer' : 'Edit customer'),
      content: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          TextField(controller: name, decoration: const InputDecoration(labelText: 'Name')),
          TextField(controller: email, decoration: const InputDecoration(labelText: 'Email')),
        ],
      ),
      actions: [
        TextButton(onPressed: () => Navigator.pop(context), child: const Text('Cancel')),
        FilledButton(
          onPressed: () async {
            await ref.read(sandboxStoreProvider.notifier).upsertCustomer(
              SandboxCustomer(
                id: existing?.id ?? 'sbx_cus_${DateTime.now().microsecondsSinceEpoch}',
                name: name.text.trim(),
                email: email.text.trim(),
                createdAt: existing?.createdAt ?? DateTime.now(),
              ),
            );
            if (context.mounted) Navigator.pop(context);
          },
          child: const Text('Save'),
        ),
      ],
    ),
  );
}
