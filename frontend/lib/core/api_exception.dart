class FieldMessage {
  const FieldMessage({required this.field, required this.message});

  final String field;
  final String message;
}

/// Merchant-facing API failure. Widgets should show [merchantMessage], never raw JSON.
class ApiException implements Exception {
  const ApiException({
    required this.merchantMessage,
    this.statusCode,
    this.fields = const [],
  });

  final String merchantMessage;
  final int? statusCode;
  final List<FieldMessage> fields;

  bool get isUnauthorized => statusCode == 401;

  factory ApiException.fromEnvelope({
    required int? statusCode,
    required Object? error,
  }) {
    final fields = <FieldMessage>[];
    String? serverMessage;
    if (error is Map) {
      serverMessage = error['message']?.toString();
      final rawFields = error['fields'];
      if (rawFields is List) {
        for (final item in rawFields) {
          if (item is Map) {
            fields.add(
              FieldMessage(
                field: item['field']?.toString() ?? '',
                message: item['message']?.toString() ?? '',
              ),
            );
          }
        }
      }
    }

    return ApiException(
      statusCode: statusCode,
      fields: fields,
      merchantMessage: _merchantMessage(
        statusCode: statusCode,
        serverMessage: serverMessage,
        fields: fields,
      ),
    );
  }

  factory ApiException.network() {
    return const ApiException(
      merchantMessage:
          "Can't reach the CryptoChain server. Check your connection and that the sandbox backend is running.",
    );
  }

  factory ApiException.unknown() {
    return const ApiException(
      merchantMessage: 'Something went wrong. Please try again in a moment.',
    );
  }

  static String _merchantMessage({
    required int? statusCode,
    required String? serverMessage,
    required List<FieldMessage> fields,
  }) {
    switch (statusCode) {
      case 401:
        return "This API key isn't valid. Open Settings and paste the sandbox key from your backend.";
      case 403:
        return "This API key can't access that merchant account.";
      case 404:
        return "We couldn't find that payment.";
      case 429:
        return 'Too many requests. Wait a minute and try again.';
      case 400:
        if (fields.isNotEmpty) {
          final parts = fields
              .map((f) => '${_fieldLabel(f.field)}: ${f.message}')
              .join('\n');
          return 'Please check the highlighted fields:\n$parts';
        }
        return serverMessage ?? 'Some of the details look invalid. Please review and try again.';
      default:
        return serverMessage ?? 'Something went wrong. Please try again in a moment.';
    }
  }

  static String _fieldLabel(String field) {
    return switch (field) {
      'amountRequestedCrypto' || 'amount' => 'Amount',
      'currencyCrypto' || 'currency' => 'Currency',
      'expiresInMinutes' => 'Expiry',
      'merchantId' => 'Merchant',
      'X-API-Key' || 'apiKey' => 'API key',
      'status' => 'Status',
      'page' => 'Page',
      'limit' => 'Page size',
      _ => field.isEmpty ? 'Request' : field,
    };
  }

  @override
  String toString() => merchantMessage;
}
