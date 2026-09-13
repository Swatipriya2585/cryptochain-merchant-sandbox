import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'router.dart';

class CryptoChainApp extends ConsumerWidget {
  const CryptoChainApp({super.key, this.router});

  final RouterConfig<Object>? router;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final scheme = ColorScheme.fromSeed(
      seedColor: const Color(0xFF0F4C5C),
      brightness: Brightness.light,
    );

    return MaterialApp.router(
      title: 'CryptoChain Merchant',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        colorScheme: scheme,
        useMaterial3: true,
        appBarTheme: AppBarTheme(
          backgroundColor: scheme.surface,
          foregroundColor: scheme.onSurface,
          elevation: 0,
        ),
      ),
      routerConfig: router ?? appRouter,
    );
  }
}
