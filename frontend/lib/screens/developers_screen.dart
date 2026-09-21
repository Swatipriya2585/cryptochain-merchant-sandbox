import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../providers/env_controller.dart';
import '../providers/merchant_mode_controller.dart';
import '../sandbox/store.dart';

class DevelopersScreen extends ConsumerWidget {
  const DevelopersScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final sandboxKey = ref.watch(sandboxStoreProvider).apiKey;
    final liveKey = ref.watch(envControllerProvider).value?.profile.apiKey ?? '';
    final sandbox = ref.watch(isSandboxProvider);

    return Scaffold(
      appBar: AppBar(title: const Text('Developers')),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Text('API keys', style: Theme.of(context).textTheme.titleLarge),
          const SizedBox(height: 8),
          _KeyCard(
            label: 'Sandbox API Key',
            value: sandboxKey,
            helper: 'Prefixed sk_sandbox_ · never billed, never hits a chain.',
            emphasized: sandbox,
          ),
          _KeyCard(
            label: 'Live API Key',
            value: liveKey.isEmpty ? 'Not configured' : liveKey,
            helper: 'Existing env key. Unchanged by sandbox reset.',
            emphasized: !sandbox,
          ),
        ],
      ),
    );
  }
}

class _KeyCard extends StatelessWidget {
  const _KeyCard({
    required this.label,
    required this.value,
    required this.helper,
    required this.emphasized,
  });

  final String label;
  final String value;
  final String helper;
  final bool emphasized;

  @override
  Widget build(BuildContext context) {
    return Card(
      color: emphasized ? Theme.of(context).colorScheme.primaryContainer : null,
      child: ListTile(
        title: Text(label),
        subtitle: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            SelectableText(value),
            Text(helper),
          ],
        ),
        isThreeLine: true,
        trailing: IconButton(
          tooltip: 'Copy',
          onPressed: () => Clipboard.setData(ClipboardData(text: value)),
          icon: const Icon(Icons.copy),
        ),
      ),
    );
  }
}
