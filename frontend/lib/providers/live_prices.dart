import 'dart:async';

import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

class LivePrices {
  const LivePrices({required this.usdBySymbol, required this.fetchedAt});

  final Map<String, double> usdBySymbol;
  final DateTime fetchedAt;

  double? priceFor(String symbol) => usdBySymbol[symbol.toUpperCase()];
}

const _coingeckoIds = <String, String>{
  'BTC': 'bitcoin',
  'ETH': 'ethereum',
  'SOL': 'solana',
  'USDC': 'usd-coin',
  'USDT': 'tether',
};

final livePricesProvider = FutureProvider<LivePrices>((ref) async {
  final timer = Timer(const Duration(seconds: 20), ref.invalidateSelf);
  ref.onDispose(timer.cancel);

  final dio = Dio(
    BaseOptions(
      connectTimeout: const Duration(seconds: 8),
      receiveTimeout: const Duration(seconds: 8),
    ),
  );
  final response = await dio.get<Map<String, dynamic>>(
    'https://api.coingecko.com/api/v3/simple/price',
    queryParameters: {
      'ids': _coingeckoIds.values.join(','),
      'vs_currencies': 'usd',
    },
  );
  final body = response.data ?? const <String, dynamic>{};
  final usdBySymbol = <String, double>{};
  for (final entry in _coingeckoIds.entries) {
    final row = body[entry.value];
    if (row is Map && row['usd'] is num) {
      usdBySymbol[entry.key] = (row['usd'] as num).toDouble();
    }
  }
  if (usdBySymbol.isEmpty) {
    throw StateError('Live conversion prices were empty');
  }
  return LivePrices(usdBySymbol: usdBySymbol, fetchedAt: DateTime.now());
});
