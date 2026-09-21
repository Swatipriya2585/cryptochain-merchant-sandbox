import 'models.dart';
import 'seeded_rng.dart';

/// Canonical sandbox snapshot. Same seed always yields the same numbers so
/// a session refresh (and Reset Sandbox Data) does not reshuffle the UI.
class SandboxSeed {
  static const canonicalSeed = 870921;

  static SandboxState generate({int seed = canonicalSeed}) {
    final rng = SeededRandom(seed);
    final now = DateTime.utc(2026, 9, 21, 12);

    List<double> spark(int n, double start, double jitter) {
      final out = <double>[];
      var cursor = start;
      for (var i = 0; i < n; i++) {
        cursor += rng.range(-jitter, jitter);
        if (cursor < start * 0.6) cursor = start * 0.6;
        out.add(double.parse(cursor.toStringAsFixed(2)));
      }
      return out;
    }

    String hex(int len) {
      const chars = '0123456789abcdef';
      return List.generate(len, (_) => chars[rng.nextInt(chars.length)]).join();
    }

    final evm = MerchantWallet(
      id: 'sbx_wal_evm',
      name: 'Sandbox Treasury',
      chainFamily: 'evm',
      address: '0xSANDBOX${hex(8)}abcd',
      networks: const ['ethereum', 'base', 'polygon'],
      assets: const [
        WalletAsset(
          symbol: 'ETH',
          name: 'Ether',
          balance: 2.1845,
          usdPrice: 3420.10,
          network: 'ethereum',
        ),
        WalletAsset(
          symbol: 'USDC',
          name: 'USD Coin',
          balance: 4280.00,
          usdPrice: 1,
          network: 'base',
        ),
        WalletAsset(
          symbol: 'MATIC',
          name: 'Polygon',
          balance: 1850.25,
          usdPrice: 0.54,
          network: 'polygon',
        ),
      ],
    );

    final sol = MerchantWallet(
      id: 'sbx_wal_sol',
      name: 'Sandbox Solana Desk',
      chainFamily: 'solana',
      address: 'So1SANDBOX${hex(6)}AbCdEf',
      networks: const ['solana'],
      assets: const [
        WalletAsset(
          symbol: 'SOL',
          name: 'Solana',
          balance: 42.75,
          usdPrice: 148.22,
          network: 'solana',
        ),
        WalletAsset(
          symbol: 'USDC',
          name: 'USD Coin',
          balance: 910.50,
          usdPrice: 1,
          network: 'solana',
        ),
      ],
    );

    final portfolio = evm.portfolioUsd + sol.portfolioUsd;
    final todaySpark = spark(12, 180, 28);
    final monthlySpark = spark(14, 820, 90);
    final successSpark = spark(10, 97.2, 0.35);

    const customers = [
      ('Ava Patel', 'ava.patel@example.com'),
      ('Noah Berg', 'noah.berg@example.com'),
      ('Mia Chen', 'mia.chen@example.com'),
      ('Liam Okafor', 'liam.okafor@example.com'),
      ('Sofia Rossi', 'sofia.rossi@example.com'),
      ('Kenji Mori', 'kenji.mori@example.com'),
      ('Elena Vasquez', 'elena.vasquez@example.com'),
      ('Owen Brooks', 'owen.brooks@example.com'),
    ];

    final customerModels = [
      for (var i = 0; i < customers.length; i++)
        SandboxCustomer(
          id: 'sbx_cus_${i + 1}',
          name: customers[i].$1,
          email: customers[i].$2,
          createdAt: now.subtract(Duration(days: 20 - i)),
        ),
    ];

    final paymentStatuses = [
      'CONFIRMED',
      'PENDING',
      'CONFIRMED',
      'EXPIRED',
      'CONFIRMED',
      'UNDERPAID',
      'CONFIRMED',
      'PENDING',
    ];
    final payments = [
      for (var i = 0; i < 8; i++)
        SandboxPayment(
          id: 'sbx_pay_${i + 1}',
          amountCrypto: (0.04 + i * 0.011).toStringAsFixed(4),
          currency: i.isEven ? 'ETH' : 'USDC',
          status: paymentStatuses[i],
          reference: 'ord_sbx_${1000 + i}',
          address: evm.address,
          createdAt: now.subtract(Duration(hours: 6 * (i + 1))),
          txHash: paymentStatuses[i] == 'PENDING' ? null : '0xsandbox${hex(20)}',
          customerName: customers[i % customers.length].$1,
          network: i % 3 == 0 ? 'base' : 'ethereum',
        ),
    ];

    final txStatuses = ['confirmed', 'confirmed', 'pending', 'confirmed', 'failed', 'confirmed', 'pending', 'confirmed'];
    final transactions = [
      for (var i = 0; i < 8; i++)
        LedgerEntry(
          id: 'sbx_tx_${i + 1}',
          title: i.isEven ? 'Customer payment' : 'Treasury transfer',
          subtitle: i.isEven ? 'USDC on Base' : 'ETH on Ethereum',
          amountUsd: double.parse((120 + i * 47.35).toStringAsFixed(2)),
          status: txStatuses[i],
          createdAt: now.subtract(Duration(hours: 3 * (i + 1))),
          txHash: '0xsandbox${hex(20)}',
          counterparty: customers[i % customers.length].$1,
        ),
    ];

    final invoiceStatuses = ['paid', 'open', 'paid', 'overdue', 'open', 'paid', 'draft', 'paid'];
    final invoices = [
      for (var i = 0; i < 8; i++)
        LedgerEntry(
          id: 'sbx_inv_${i + 1}',
          title: 'INV-20${26 + i}-0${i + 1}',
          subtitle: customers[i].$1,
          amountUsd: double.parse((240 + i * 88.5).toStringAsFixed(2)),
          status: invoiceStatuses[i],
          createdAt: now.subtract(Duration(days: i + 1)),
          counterparty: customers[i].$1,
        ),
    ];

    final settlementStatuses = [
      'pending',
      'pending',
      'completed',
      'failed',
      'completed',
      'pending',
      'completed',
    ];
    final settlements = [
      for (var i = 0; i < 7; i++)
        LedgerEntry(
          id: 'sbx_set_${i + 1}',
          title: 'Batch ${i + 1}',
          subtitle: i.isEven ? 'USDC → USD' : 'ETH → USD',
          amountUsd: double.parse((980 + i * 210.25).toStringAsFixed(2)),
          status: settlementStatuses[i],
          createdAt: now.subtract(Duration(days: i)),
        ),
    ];

    MarketCoin coin(String symbol, String name, double price, double change) {
      return MarketCoin(
        symbol: symbol,
        name: name,
        usdPrice: price,
        changePercent: change,
        sparkline: spark(10, price, price * 0.03),
      );
    }

    // Fully mocked market prices (not live CoinGecko/etc.) so sandbox never
    // depends on existing live market services and numbers stay session-stable.
    final coins = [
      coin('ETH', 'Ethereum', 3420.10, 1.8),
      coin('BTC', 'Bitcoin', 63840.00, 0.6),
      coin('SOL', 'Solana', 148.22, -0.9),
      coin('MATIC', 'Polygon', 0.54, 2.4),
      coin('USDC', 'USD Coin', 1.00, 0.0),
      coin('USDT', 'Tether', 1.00, 0.0),
    ];

    final activity = [
      SmartSendActivity(
        id: 'sbx_ss_1',
        quoteId: 'sbx_quote_demo',
        walletName: evm.name,
        fromSymbol: 'USDC',
        toSymbol: 'ETH',
        amount: 250,
        recipient: '0xSANDBOXmerchant00ab',
        txHash: '0xsandbox${hex(20)}',
        route: 'Mock router · Uniswap V3 · Base',
        createdAt: now.subtract(const Duration(hours: 18)),
        status: 'completed',
      ),
    ];

    return SandboxState(
      seed: seed,
      apiKey: 'sk_sandbox_${hex(24)}',
      wallets: [evm, sol],
      defaultWalletByNetwork: {
        'ethereum': evm.id,
        'base': evm.id,
        'polygon': evm.id,
        'solana': sol.id,
      },
      metrics: DashboardMetrics(
        portfolioUsd: double.parse(portfolio.toStringAsFixed(2)),
        todayPaymentsUsd: 1284.60,
        monthlyVolumeUsd: 18420.75,
        todaySparkline: todaySpark,
        monthlySparkline: monthlySpark,
        successRatePercent: 97.8,
        successSparkline: successSpark,
        feesSavedUsd: 312.48,
        avgConfirmationSeconds: 18.4,
        confirmedVolumeCrypto: '3.4200',
        currencyCrypto: 'ETH',
        pendingCount: payments.where((p) => p.status == 'PENDING').length,
        confirmedCount: payments.where((p) => p.status == 'CONFIRMED').length,
        totalPaymentIntents: payments.length,
      ),
      payments: payments,
      transactions: transactions,
      invoices: invoices,
      customers: customerModels,
      settlements: settlements,
      coins: coins,
      tokenOfDaySymbol: 'SOL',
      smartSendActivity: activity,
    );
  }
}
