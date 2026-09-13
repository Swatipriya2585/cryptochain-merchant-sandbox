import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../config/app_mode.dart';
import '../providers/env_controller.dart';

class SettingsScreen extends ConsumerStatefulWidget {
  const SettingsScreen({super.key});

  @override
  ConsumerState<SettingsScreen> createState() => _SettingsScreenState();
}

class _SettingsScreenState extends ConsumerState<SettingsScreen> {
  late final TextEditingController _merchant;
  late final TextEditingController _apiKey;
  bool _hydrated = false;

  @override
  void initState() {
    super.initState();
    _merchant = TextEditingController();
    _apiKey = TextEditingController();
  }

  @override
  void dispose() {
    _merchant.dispose();
    _apiKey.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final async = ref.watch(envControllerProvider);

    return Scaffold(
      appBar: AppBar(title: const Text('Settings')),
      body: async.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (error, _) => Center(child: Text('$error')),
        data: (session) {
          if (!_hydrated) {
            _merchant.text = session.profile.merchantId;
            _apiKey.text = session.profile.apiKey;
            _hydrated = true;
          }
          return ListView(
            padding: const EdgeInsets.all(16),
            children: [
              Text('Environment', style: Theme.of(context).textTheme.titleMedium),
              const SizedBox(height: 8),
              if (session.policy.showModeToggle)
                SegmentedButton<AppMode>(
                  segments: const [
                    ButtonSegment(value: AppMode.sandbox, label: Text('Sandbox')),
                    ButtonSegment(value: AppMode.live, label: Text('Live')),
                  ],
                  selected: {session.mode},
                  onSelectionChanged: (value) async {
                    final next = value.first;
                    if (next == AppMode.live) {
                      final ok = await showDialog<bool>(
                        context: context,
                        builder: (context) => AlertDialog(
                          title: const Text('Switch to LIVE?'),
                          content: const Text(
                            'LIVE points at production / mainnet. This can move real funds. '
                            'Only continue after the cutover checklist is signed off.',
                          ),
                          actions: [
                            TextButton(
                              onPressed: () => Navigator.pop(context, false),
                              child: const Text('Stay on sandbox'),
                            ),
                            FilledButton(
                              onPressed: () => Navigator.pop(context, true),
                              child: const Text('Use LIVE'),
                            ),
                          ],
                        ),
                      );
                      if (ok != true) return;
                    }
                    await ref.read(envControllerProvider.notifier).selectMode(next);
                  },
                )
              else
                const Text(
                  'This release is locked to sandbox. Compile with '
                  '--dart-define=ENABLE_LIVE_MODE=true to allow LIVE.',
                ),
              const SizedBox(height: 8),
              Text(
                session.policy.canSelectLive
                    ? 'Debug builds may switch modes. Release builds cannot select LIVE unless ENABLE_LIVE_MODE is set.'
                    : 'LIVE is disabled in this build to prevent accidental mainnet usage.',
                style: Theme.of(context).textTheme.bodySmall,
              ),
              const SizedBox(height: 20),
              ListTile(
                contentPadding: EdgeInsets.zero,
                title: const Text('API base URL'),
                subtitle: Text(
                  session.profile.apiBaseUrl.isEmpty
                      ? 'Not configured'
                      : session.profile.apiBaseUrl,
                ),
              ),
              ListTile(
                contentPadding: EdgeInsets.zero,
                title: const Text('Chain'),
                subtitle: Text(session.profile.chainName),
              ),
              const SizedBox(height: 8),
              TextField(
                controller: _merchant,
                decoration: const InputDecoration(
                  labelText: 'Merchant ID',
                  border: OutlineInputBorder(),
                ),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: _apiKey,
                obscureText: true,
                decoration: const InputDecoration(
                  labelText: 'API key',
                  helperText: 'Sandbox keys start with sandbox_',
                  border: OutlineInputBorder(),
                ),
              ),
              const SizedBox(height: 16),
              FilledButton(
                onPressed: () async {
                  await ref.read(envControllerProvider.notifier).saveCredentials(
                    merchantId: _merchant.text,
                    apiKey: _apiKey.text,
                  );
                  if (context.mounted) {
                    ScaffoldMessenger.of(context).showSnackBar(
                      const SnackBar(content: Text('Saved')),
                    );
                  }
                },
                child: const Text('Save credentials'),
              ),
            ],
          );
        },
      ),
    );
  }
}
