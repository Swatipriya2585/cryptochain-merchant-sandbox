import 'package:intl/intl.dart';

final usdFormat = NumberFormat.currency(symbol: r'$', decimalDigits: 2);

String formatUsd(double value) => usdFormat.format(value);

class MerchantWallet {
  const MerchantWallet({
    required this.id,
    required this.name,
    required this.chainFamily,
    required this.address,
    required this.networks,
    required this.assets,
  });

  final String id;
  final String name;
  /// `evm` or `solana`
  final String chainFamily;
  final String address;
  final List<String> networks;
  final List<WalletAsset> assets;

  double get portfolioUsd =>
      assets.fold<double>(0, (sum, asset) => sum + asset.usdValue);

  MerchantWallet copyWith({
    String? name,
    List<WalletAsset>? assets,
  }) {
    return MerchantWallet(
      id: id,
      name: name ?? this.name,
      chainFamily: chainFamily,
      address: address,
      networks: networks,
      assets: assets ?? this.assets,
    );
  }

  Map<String, dynamic> toJson() => {
    'id': id,
    'name': name,
    'chainFamily': chainFamily,
    'address': address,
    'networks': networks,
    'assets': assets.map((item) => item.toJson()).toList(),
  };

  factory MerchantWallet.fromJson(Map<String, dynamic> json) {
    return MerchantWallet(
      id: json['id'] as String,
      name: json['name'] as String,
      chainFamily: json['chainFamily'] as String,
      address: json['address'] as String,
      networks: (json['networks'] as List<dynamic>).map((e) => e.toString()).toList(),
      assets: (json['assets'] as List<dynamic>)
          .map((e) => WalletAsset.fromJson(Map<String, dynamic>.from(e as Map)))
          .toList(),
    );
  }
}

class WalletAsset {
  const WalletAsset({
    required this.symbol,
    required this.name,
    required this.balance,
    required this.usdPrice,
    required this.network,
  });

  final String symbol;
  final String name;
  final double balance;
  final double usdPrice;
  final String network;

  double get usdValue => balance * usdPrice;

  WalletAsset copyWith({double? balance}) {
    return WalletAsset(
      symbol: symbol,
      name: name,
      balance: balance ?? this.balance,
      usdPrice: usdPrice,
      network: network,
    );
  }

  Map<String, dynamic> toJson() => {
    'symbol': symbol,
    'name': name,
    'balance': balance,
    'usdPrice': usdPrice,
    'network': network,
  };

  factory WalletAsset.fromJson(Map<String, dynamic> json) {
    return WalletAsset(
      symbol: json['symbol'] as String,
      name: json['name'] as String,
      balance: (json['balance'] as num).toDouble(),
      usdPrice: (json['usdPrice'] as num).toDouble(),
      network: json['network'] as String,
    );
  }
}

class DashboardMetrics {
  const DashboardMetrics({
    required this.portfolioUsd,
    required this.todayPaymentsUsd,
    required this.monthlyVolumeUsd,
    required this.todaySparkline,
    required this.monthlySparkline,
    required this.successRatePercent,
    required this.successSparkline,
    required this.feesSavedUsd,
    required this.avgConfirmationSeconds,
    required this.confirmedVolumeCrypto,
    required this.currencyCrypto,
    required this.pendingCount,
    required this.confirmedCount,
    required this.totalPaymentIntents,
  });

  final double portfolioUsd;
  final double todayPaymentsUsd;
  final double monthlyVolumeUsd;
  final List<double> todaySparkline;
  final List<double> monthlySparkline;
  final double successRatePercent;
  final List<double> successSparkline;
  final double feesSavedUsd;
  final double avgConfirmationSeconds;
  final String confirmedVolumeCrypto;
  final String currencyCrypto;
  final int pendingCount;
  final int confirmedCount;
  final int totalPaymentIntents;

  Map<String, dynamic> toJson() => {
    'portfolioUsd': portfolioUsd,
    'todayPaymentsUsd': todayPaymentsUsd,
    'monthlyVolumeUsd': monthlyVolumeUsd,
    'todaySparkline': todaySparkline,
    'monthlySparkline': monthlySparkline,
    'successRatePercent': successRatePercent,
    'successSparkline': successSparkline,
    'feesSavedUsd': feesSavedUsd,
    'avgConfirmationSeconds': avgConfirmationSeconds,
    'confirmedVolumeCrypto': confirmedVolumeCrypto,
    'currencyCrypto': currencyCrypto,
    'pendingCount': pendingCount,
    'confirmedCount': confirmedCount,
    'totalPaymentIntents': totalPaymentIntents,
  };

  factory DashboardMetrics.fromJson(Map<String, dynamic> json) {
    List<double> series(String key) =>
        (json[key] as List<dynamic>).map((e) => (e as num).toDouble()).toList();
    return DashboardMetrics(
      portfolioUsd: (json['portfolioUsd'] as num).toDouble(),
      todayPaymentsUsd: (json['todayPaymentsUsd'] as num).toDouble(),
      monthlyVolumeUsd: (json['monthlyVolumeUsd'] as num).toDouble(),
      todaySparkline: series('todaySparkline'),
      monthlySparkline: series('monthlySparkline'),
      successRatePercent: (json['successRatePercent'] as num).toDouble(),
      successSparkline: series('successSparkline'),
      feesSavedUsd: (json['feesSavedUsd'] as num).toDouble(),
      avgConfirmationSeconds: (json['avgConfirmationSeconds'] as num).toDouble(),
      confirmedVolumeCrypto: json['confirmedVolumeCrypto'].toString(),
      currencyCrypto: json['currencyCrypto'] as String,
      pendingCount: (json['pendingCount'] as num).toInt(),
      confirmedCount: (json['confirmedCount'] as num).toInt(),
      totalPaymentIntents: (json['totalPaymentIntents'] as num).toInt(),
    );
  }
}

class SandboxPayment {
  const SandboxPayment({
    required this.id,
    required this.amountCrypto,
    required this.currency,
    required this.status,
    required this.reference,
    required this.address,
    required this.createdAt,
    this.txHash,
    this.customerName,
    this.network = 'ethereum',
  });

  final String id;
  final String amountCrypto;
  final String currency;
  final String status;
  final String reference;
  final String address;
  final DateTime createdAt;
  final String? txHash;
  final String? customerName;
  final String network;

  Map<String, dynamic> toJson() => {
    'id': id,
    'amountCrypto': amountCrypto,
    'currency': currency,
    'status': status,
    'reference': reference,
    'address': address,
    'createdAt': createdAt.toIso8601String(),
    'txHash': txHash,
    'customerName': customerName,
    'network': network,
  };

  factory SandboxPayment.fromJson(Map<String, dynamic> json) {
    return SandboxPayment(
      id: json['id'] as String,
      amountCrypto: json['amountCrypto'].toString(),
      currency: json['currency'] as String,
      status: json['status'] as String,
      reference: json['reference'] as String,
      address: json['address'] as String,
      createdAt: DateTime.parse(json['createdAt'] as String),
      txHash: json['txHash'] as String?,
      customerName: json['customerName'] as String?,
      network: json['network'] as String? ?? 'ethereum',
    );
  }
}

class LedgerEntry {
  const LedgerEntry({
    required this.id,
    required this.title,
    required this.subtitle,
    required this.amountUsd,
    required this.status,
    required this.createdAt,
    this.txHash,
    this.counterparty,
  });

  final String id;
  final String title;
  final String subtitle;
  final double amountUsd;
  final String status;
  final DateTime createdAt;
  final String? txHash;
  final String? counterparty;

  LedgerEntry copyWith({String? status, String? title}) {
    return LedgerEntry(
      id: id,
      title: title ?? this.title,
      subtitle: subtitle,
      amountUsd: amountUsd,
      status: status ?? this.status,
      createdAt: createdAt,
      txHash: txHash,
      counterparty: counterparty,
    );
  }

  Map<String, dynamic> toJson() => {
    'id': id,
    'title': title,
    'subtitle': subtitle,
    'amountUsd': amountUsd,
    'status': status,
    'createdAt': createdAt.toIso8601String(),
    'txHash': txHash,
    'counterparty': counterparty,
  };

  factory LedgerEntry.fromJson(Map<String, dynamic> json) {
    return LedgerEntry(
      id: json['id'] as String,
      title: json['title'] as String,
      subtitle: json['subtitle'] as String,
      amountUsd: (json['amountUsd'] as num).toDouble(),
      status: json['status'] as String,
      createdAt: DateTime.parse(json['createdAt'] as String),
      txHash: json['txHash'] as String?,
      counterparty: json['counterparty'] as String?,
    );
  }
}

class SandboxCustomer {
  const SandboxCustomer({
    required this.id,
    required this.name,
    required this.email,
    required this.createdAt,
    this.notes = '',
  });

  final String id;
  final String name;
  final String email;
  final DateTime createdAt;
  final String notes;

  SandboxCustomer copyWith({String? name, String? email, String? notes}) {
    return SandboxCustomer(
      id: id,
      name: name ?? this.name,
      email: email ?? this.email,
      createdAt: createdAt,
      notes: notes ?? this.notes,
    );
  }

  Map<String, dynamic> toJson() => {
    'id': id,
    'name': name,
    'email': email,
    'createdAt': createdAt.toIso8601String(),
    'notes': notes,
  };

  factory SandboxCustomer.fromJson(Map<String, dynamic> json) {
    return SandboxCustomer(
      id: json['id'] as String,
      name: json['name'] as String,
      email: json['email'] as String,
      createdAt: DateTime.parse(json['createdAt'] as String),
      notes: json['notes'] as String? ?? '',
    );
  }
}

class MarketCoin {
  const MarketCoin({
    required this.symbol,
    required this.name,
    required this.usdPrice,
    required this.changePercent,
    required this.sparkline,
  });

  final String symbol;
  final String name;
  final double usdPrice;
  final double changePercent;
  final List<double> sparkline;

  Map<String, dynamic> toJson() => {
    'symbol': symbol,
    'name': name,
    'usdPrice': usdPrice,
    'changePercent': changePercent,
    'sparkline': sparkline,
  };

  factory MarketCoin.fromJson(Map<String, dynamic> json) {
    return MarketCoin(
      symbol: json['symbol'] as String,
      name: json['name'] as String,
      usdPrice: (json['usdPrice'] as num).toDouble(),
      changePercent: (json['changePercent'] as num).toDouble(),
      sparkline: (json['sparkline'] as List<dynamic>)
          .map((e) => (e as num).toDouble())
          .toList(),
    );
  }
}

class SmartSendQuote {
  const SmartSendQuote({
    required this.id,
    required this.walletId,
    required this.fromSymbol,
    required this.toSymbol,
    required this.amount,
    required this.recipient,
    required this.exchangeRate,
    required this.gasFeeUsd,
    required this.route,
    required this.receiveAmount,
  });

  final String id;
  final String walletId;
  final String fromSymbol;
  final String toSymbol;
  final double amount;
  final String recipient;
  final double exchangeRate;
  final double gasFeeUsd;
  final String route;
  final double receiveAmount;
}

class SmartSendActivity {
  const SmartSendActivity({
    required this.id,
    required this.quoteId,
    required this.walletName,
    required this.fromSymbol,
    required this.toSymbol,
    required this.amount,
    required this.recipient,
    required this.txHash,
    required this.route,
    required this.createdAt,
    required this.status,
  });

  final String id;
  final String quoteId;
  final String walletName;
  final String fromSymbol;
  final String toSymbol;
  final double amount;
  final String recipient;
  final String txHash;
  final String route;
  final DateTime createdAt;
  final String status;

  Map<String, dynamic> toJson() => {
    'id': id,
    'quoteId': quoteId,
    'walletName': walletName,
    'fromSymbol': fromSymbol,
    'toSymbol': toSymbol,
    'amount': amount,
    'recipient': recipient,
    'txHash': txHash,
    'route': route,
    'createdAt': createdAt.toIso8601String(),
    'status': status,
  };

  factory SmartSendActivity.fromJson(Map<String, dynamic> json) {
    return SmartSendActivity(
      id: json['id'] as String,
      quoteId: json['quoteId'] as String,
      walletName: json['walletName'] as String,
      fromSymbol: json['fromSymbol'] as String,
      toSymbol: json['toSymbol'] as String,
      amount: (json['amount'] as num).toDouble(),
      recipient: json['recipient'] as String,
      txHash: json['txHash'] as String,
      route: json['route'] as String,
      createdAt: DateTime.parse(json['createdAt'] as String),
      status: json['status'] as String,
    );
  }
}

class SandboxState {
  const SandboxState({
    required this.seed,
    required this.apiKey,
    required this.wallets,
    required this.defaultWalletByNetwork,
    required this.metrics,
    required this.payments,
    required this.transactions,
    required this.invoices,
    required this.customers,
    required this.settlements,
    required this.coins,
    required this.tokenOfDaySymbol,
    required this.smartSendActivity,
  });

  final int seed;
  final String apiKey;
  final List<MerchantWallet> wallets;
  final Map<String, String> defaultWalletByNetwork;
  final DashboardMetrics metrics;
  final List<SandboxPayment> payments;
  final List<LedgerEntry> transactions;
  final List<LedgerEntry> invoices;
  final List<SandboxCustomer> customers;
  final List<LedgerEntry> settlements;
  final List<MarketCoin> coins;
  final String tokenOfDaySymbol;
  final List<SmartSendActivity> smartSendActivity;

  MerchantWallet? walletById(String id) {
    for (final wallet in wallets) {
      if (wallet.id == id) return wallet;
    }
    return null;
  }

  SandboxState copyWith({
    List<MerchantWallet>? wallets,
    Map<String, String>? defaultWalletByNetwork,
    List<SandboxPayment>? payments,
    List<LedgerEntry>? transactions,
    List<LedgerEntry>? invoices,
    List<SandboxCustomer>? customers,
    List<LedgerEntry>? settlements,
    List<SmartSendActivity>? smartSendActivity,
  }) {
    return SandboxState(
      seed: seed,
      apiKey: apiKey,
      wallets: wallets ?? this.wallets,
      defaultWalletByNetwork: defaultWalletByNetwork ?? this.defaultWalletByNetwork,
      metrics: metrics,
      payments: payments ?? this.payments,
      transactions: transactions ?? this.transactions,
      invoices: invoices ?? this.invoices,
      customers: customers ?? this.customers,
      settlements: settlements ?? this.settlements,
      coins: coins,
      tokenOfDaySymbol: tokenOfDaySymbol,
      smartSendActivity: smartSendActivity ?? this.smartSendActivity,
    );
  }

  Map<String, dynamic> toJson() => {
    'seed': seed,
    'apiKey': apiKey,
    'wallets': wallets.map((e) => e.toJson()).toList(),
    'defaultWalletByNetwork': defaultWalletByNetwork,
    'metrics': metrics.toJson(),
    'payments': payments.map((e) => e.toJson()).toList(),
    'transactions': transactions.map((e) => e.toJson()).toList(),
    'invoices': invoices.map((e) => e.toJson()).toList(),
    'customers': customers.map((e) => e.toJson()).toList(),
    'settlements': settlements.map((e) => e.toJson()).toList(),
    'coins': coins.map((e) => e.toJson()).toList(),
    'tokenOfDaySymbol': tokenOfDaySymbol,
    'smartSendActivity': smartSendActivity.map((e) => e.toJson()).toList(),
  };

  factory SandboxState.fromJson(Map<String, dynamic> json) {
    Map<String, String> defaults = {};
    final raw = json['defaultWalletByNetwork'];
    if (raw is Map) {
      raw.forEach((key, value) {
        defaults[key.toString()] = value.toString();
      });
    }
    List<Map<String, dynamic>> maps(String key) => (json[key] as List<dynamic>? ?? [])
        .map((e) => Map<String, dynamic>.from(e as Map))
        .toList();
    return SandboxState(
      seed: (json['seed'] as num).toInt(),
      apiKey: json['apiKey'] as String,
      wallets: maps('wallets').map(MerchantWallet.fromJson).toList(),
      defaultWalletByNetwork: defaults,
      metrics: DashboardMetrics.fromJson(Map<String, dynamic>.from(json['metrics'] as Map)),
      payments: maps('payments').map(SandboxPayment.fromJson).toList(),
      transactions: maps('transactions').map(LedgerEntry.fromJson).toList(),
      invoices: maps('invoices').map(LedgerEntry.fromJson).toList(),
      customers: maps('customers').map(SandboxCustomer.fromJson).toList(),
      settlements: maps('settlements').map(LedgerEntry.fromJson).toList(),
      coins: maps('coins').map(MarketCoin.fromJson).toList(),
      tokenOfDaySymbol: json['tokenOfDaySymbol'] as String,
      smartSendActivity: maps('smartSendActivity').map(SmartSendActivity.fromJson).toList(),
    );
  }
}
