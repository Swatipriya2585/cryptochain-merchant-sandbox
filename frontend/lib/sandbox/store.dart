import 'dart:convert';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'models.dart';
import 'seed.dart';
import 'seeded_rng.dart';

/// Isolated in-memory + SharedPreferences sandbox database.
///
/// Isolation choice: **do not add Prisma models**. Live merchants, payment
/// intents, and payouts stay on the existing Postgres schema. Sandbox state
/// never shares a table, prefix, or API client with that schema, so a Reset
/// or CRUD action cannot mutate production rows. The merchant UI swaps this
/// store in through [merchantModeProvider] rather than branching in widgets.
const sandboxPrefsKey = 'cryptochain.sandbox_state.v1';

class SandboxStore extends Notifier<SandboxState> {
  @override
  SandboxState build() {
    Future.microtask(_hydrate);
    return SandboxSeed.generate();
  }

  SandboxState get snapshot => state;

  Future<void> _hydrate() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final raw = prefs.getString(sandboxPrefsKey);
      if (raw == null || raw.isEmpty) {
        await _persist();
        return;
      }
      state = SandboxState.fromJson(jsonDecode(raw) as Map<String, dynamic>);
    } catch (_) {
      // Tests and first-run without a prefs plugin keep the canonical seed.
    }
  }

  Future<void> _persist() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString(sandboxPrefsKey, jsonEncode(state.toJson()));
    } catch (_) {}
  }

  Future<void> ensureReady() async {
    if (state.wallets.isEmpty) {
      await reset();
      return;
    }
    await _persist();
  }

  Future<void> reset() async {
    state = SandboxSeed.generate();
    await _persist();
  }

  Future<void> renameWallet(String id, String name) async {
    final trimmed = name.trim();
    if (trimmed.isEmpty) return;
    state = state.copyWith(
      wallets: [
        for (final wallet in state.wallets)
          if (wallet.id == id) wallet.copyWith(name: trimmed) else wallet,
      ],
    );
    await _persist();
  }

  Future<void> setDefaultWallet(String network, String walletId) async {
    final next = Map<String, String>.from(state.defaultWalletByNetwork);
    next[network] = walletId;
    state = state.copyWith(defaultWalletByNetwork: next);
    await _persist();
  }

  Future<void> applySend({
    required String walletId,
    required String symbol,
    required double amount,
    required String recipient,
  }) async {
    if (amount <= 0) return;
    MerchantWallet? updated;
    final wallets = [
      for (final wallet in state.wallets)
        if (wallet.id == walletId)
          () {
            final assets = [
              for (final asset in wallet.assets)
                if (asset.symbol == symbol)
                  asset.copyWith(balance: (asset.balance - amount).clamp(0, 1e12))
                else
                  asset,
            ];
            updated = wallet.copyWith(assets: assets);
            return updated!;
          }()
        else
          wallet,
    ];
    final wallet = updated ?? state.walletById(walletId);
    final rng = SeededRandom(state.seed + DateTime.now().microsecondsSinceEpoch);
    final tx = LedgerEntry(
      id: 'sbx_tx_${DateTime.now().microsecondsSinceEpoch}',
      title: 'Sent $symbol',
      subtitle: 'To $recipient',
      amountUsd: amount * (wallet?.assets.where((a) => a.symbol == symbol).firstOrNull?.usdPrice ?? 1),
      status: 'confirmed',
      createdAt: DateTime.now(),
      txHash: '0xsandbox${rng.hex(24)}',
      counterparty: recipient,
    );
    state = state.copyWith(
      wallets: wallets,
      transactions: [tx, ...state.transactions],
    );
    await _persist();
  }

  Future<SandboxPayment> addPayment({
    required String amountCrypto,
    required String currencyCrypto,
  }) async {
    final rng = SeededRandom(state.seed + state.payments.length + 17);
    final wallet = state.wallets.first;
    final payment = SandboxPayment(
      id: 'sbx_pay_${DateTime.now().microsecondsSinceEpoch}',
      amountCrypto: amountCrypto,
      currency: currencyCrypto,
      status: 'PENDING',
      reference: 'ord_sbx_${1000 + state.payments.length}',
      address: wallet.address,
      createdAt: DateTime.now(),
      network: 'ethereum',
    );
    // silence unused in case of future hash stamping
    rng.nextInt(8);
    state = state.copyWith(payments: [payment, ...state.payments]);
    await _persist();
    return payment;
  }

  Future<void> upsertCustomer(SandboxCustomer customer) async {
    final exists = state.customers.any((item) => item.id == customer.id);
    state = state.copyWith(
      customers: exists
          ? [
              for (final item in state.customers)
                if (item.id == customer.id) customer else item,
            ]
          : [customer, ...state.customers],
    );
    await _persist();
  }

  Future<void> deleteCustomer(String id) async {
    state = state.copyWith(
      customers: state.customers.where((item) => item.id != id).toList(),
    );
    await _persist();
  }

  Future<void> upsertInvoice(LedgerEntry invoice) async {
    final exists = state.invoices.any((item) => item.id == invoice.id);
    state = state.copyWith(
      invoices: exists
          ? [
              for (final item in state.invoices)
                if (item.id == invoice.id) invoice else item,
            ]
          : [invoice, ...state.invoices],
    );
    await _persist();
  }

  Future<void> deleteInvoice(String id) async {
    state = state.copyWith(
      invoices: state.invoices.where((item) => item.id != id).toList(),
    );
    await _persist();
  }

  Future<void> upsertSettlement(LedgerEntry settlement) async {
    final exists = state.settlements.any((item) => item.id == settlement.id);
    state = state.copyWith(
      settlements: exists
          ? [
              for (final item in state.settlements)
                if (item.id == settlement.id) settlement else item,
            ]
          : [settlement, ...state.settlements],
    );
    await _persist();
  }

  Future<SmartSendQuote> quote({
    required String walletId,
    required String fromSymbol,
    required String toSymbol,
    required double amount,
    required String recipient,
  }) async {
    final rng = SeededRandom(state.seed + amount.round() + fromSymbol.hashCode);
    final from = state.coins.where((c) => c.symbol == fromSymbol).firstOrNull;
    final to = state.coins.where((c) => c.symbol == toSymbol).firstOrNull;
    final fromPrice = from?.usdPrice ?? 1;
    final toPrice = to?.usdPrice ?? 1;
    final rate = fromPrice / toPrice;
    return SmartSendQuote(
      id: 'sbx_quote_${DateTime.now().microsecondsSinceEpoch}',
      walletId: walletId,
      fromSymbol: fromSymbol,
      toSymbol: toSymbol,
      amount: amount,
      recipient: recipient,
      exchangeRate: double.parse(rate.toStringAsFixed(6)),
      gasFeeUsd: double.parse(rng.range(0.12, 1.85).toStringAsFixed(2)),
      route: 'Mock router · Uniswap V3 · Base (no LI.FI / Jupiter / RPC)',
      receiveAmount: double.parse((amount * rate).toStringAsFixed(6)),
    );
  }

  Future<SmartSendActivity> completeSmartSend(SmartSendQuote quote) async {
    await applySend(
      walletId: quote.walletId,
      symbol: quote.fromSymbol,
      amount: quote.amount,
      recipient: quote.recipient,
    );
    final wallet = state.walletById(quote.walletId);
    final rng = SeededRandom(state.seed + quote.id.hashCode);
    final activity = SmartSendActivity(
      id: 'sbx_ss_${DateTime.now().microsecondsSinceEpoch}',
      quoteId: quote.id,
      walletName: wallet?.name ?? 'Sandbox wallet',
      fromSymbol: quote.fromSymbol,
      toSymbol: quote.toSymbol,
      amount: quote.amount,
      recipient: quote.recipient,
      txHash: '0xsandbox${rng.hex(24)}',
      route: quote.route,
      createdAt: DateTime.now(),
      status: 'completed',
    );
    state = state.copyWith(smartSendActivity: [activity, ...state.smartSendActivity]);
    await _persist();
    return activity;
  }

  Future<void> mockSwap({
    required String walletId,
    required String fromSymbol,
    required String toSymbol,
    required double amount,
  }) async {
    final quote = await this.quote(
      walletId: walletId,
      fromSymbol: fromSymbol,
      toSymbol: toSymbol,
      amount: amount,
      recipient: state.walletById(walletId)?.address ?? 'sandbox',
    );
    final wallets = [
      for (final wallet in state.wallets)
        if (wallet.id == walletId)
          wallet.copyWith(
            assets: [
              for (final asset in wallet.assets)
                if (asset.symbol == fromSymbol)
                  asset.copyWith(balance: (asset.balance - amount).clamp(0, 1e12))
                else if (asset.symbol == toSymbol)
                  asset.copyWith(balance: asset.balance + quote.receiveAmount)
                else
                  asset,
            ],
          )
        else
          wallet,
    ];
    state = state.copyWith(wallets: wallets);
    await _persist();
  }
}

final sandboxStoreProvider = NotifierProvider<SandboxStore, SandboxState>(SandboxStore.new);
