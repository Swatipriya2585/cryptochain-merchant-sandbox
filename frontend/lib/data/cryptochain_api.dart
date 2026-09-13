import 'package:dio/dio.dart';

import '../config/env_profile.dart';
import '../core/api_exception.dart';
import 'models/merchant_summary.dart';
import 'models/payment_intent.dart';

class CryptochainApi {
  CryptochainApi({required this.dio, required this.session});

  factory CryptochainApi.fromSession(EnvProfile profile, {Dio? dio}) {
    final client =
        dio ??
        Dio(
          BaseOptions(
            baseUrl: profile.apiBaseUrl,
            connectTimeout: const Duration(seconds: 10),
            receiveTimeout: const Duration(seconds: 20),
            headers: {
              'Accept': 'application/json',
              'Content-Type': 'application/json',
              'X-API-Key': profile.apiKey,
            },
          ),
        );
    client.options.baseUrl = profile.apiBaseUrl;
    client.options.headers['X-API-Key'] = profile.apiKey;
    return CryptochainApi(dio: client, session: profile);
  }

  final Dio dio;
  final EnvProfile session;

  Future<MerchantSummary> getSummary() async {
    final data = await _get('/api/v1/merchants/${session.merchantId}/summary');
    return MerchantSummary.fromJson(data);
  }

  Future<PaginatedPaymentIntents> listPaymentIntents({
    PaymentStatus? status,
    int page = 1,
    int limit = 20,
  }) async {
    final data = await _get(
      '/api/v1/merchants/${session.merchantId}/payment-intents',
      query: {
        'page': page,
        'limit': limit,
        if (status != null) 'status': status.apiValue,
      },
    );
    return PaginatedPaymentIntents.fromJson(data);
  }

  Future<PaymentIntent> getPaymentIntent(String id) async {
    final data = await _get('/api/v1/payment-intents/$id');
    return PaymentIntent.fromJson(data);
  }

  Future<PaymentIntent> createPaymentIntent({
    required String amountRequestedCrypto,
    required String currencyCrypto,
    required int expiresInMinutes,
  }) async {
    final data = await _post('/api/v1/payment-intents', {
      'merchantId': session.merchantId,
      'amountRequestedCrypto': amountRequestedCrypto,
      'currencyCrypto': currencyCrypto,
      'expiresInMinutes': expiresInMinutes,
    });
    return PaymentIntent.fromJson(data);
  }

  Future<Map<String, dynamic>> _get(String path, {Map<String, dynamic>? query}) async {
    try {
      final response = await dio.get<Map<String, dynamic>>(path, queryParameters: query);
      return _unwrap(response);
    } on ApiException {
      rethrow;
    } on DioException catch (error) {
      throw _fromDio(error);
    }
  }

  Future<Map<String, dynamic>> _post(String path, Map<String, dynamic> body) async {
    try {
      final response = await dio.post<Map<String, dynamic>>(path, data: body);
      return _unwrap(response);
    } on ApiException {
      rethrow;
    } on DioException catch (error) {
      throw _fromDio(error);
    }
  }

  Map<String, dynamic> _unwrap(Response<Map<String, dynamic>> response) {
    final body = response.data ?? const {};
    if (body['error'] != null) {
      throw ApiException.fromEnvelope(statusCode: response.statusCode, error: body['error']);
    }
    final data = body['data'];
    if (data is Map) {
      return Map<String, dynamic>.from(data);
    }
    throw ApiException.unknown();
  }

  ApiException _fromDio(DioException error) {
    if (error.type == DioExceptionType.connectionError ||
        error.type == DioExceptionType.connectionTimeout ||
        error.type == DioExceptionType.receiveTimeout ||
        error.type == DioExceptionType.sendTimeout) {
      return ApiException.network();
    }
    final data = error.response?.data;
    if (data is Map && data['error'] != null) {
      return ApiException.fromEnvelope(statusCode: error.response?.statusCode, error: data['error']);
    }
    if (error.response?.statusCode != null) {
      return ApiException.fromEnvelope(
        statusCode: error.response!.statusCode,
        error: {'message': error.message},
      );
    }
    return ApiException.network();
  }
}

abstract class CryptochainRepository {
  Future<MerchantSummary> getSummary();
  Future<PaginatedPaymentIntents> listPaymentIntents({
    PaymentStatus? status,
    int page = 1,
    int limit = 20,
  });
  Future<PaymentIntent> getPaymentIntent(String id);
  Future<PaymentIntent> createPaymentIntent({
    required String amountRequestedCrypto,
    required String currencyCrypto,
    required int expiresInMinutes,
  });
}

class RemoteCryptochainRepository implements CryptochainRepository {
  RemoteCryptochainRepository(this._api);

  final CryptochainApi _api;

  @override
  Future<MerchantSummary> getSummary() => _api.getSummary();

  @override
  Future<PaginatedPaymentIntents> listPaymentIntents({
    PaymentStatus? status,
    int page = 1,
    int limit = 20,
  }) => _api.listPaymentIntents(status: status, page: page, limit: limit);

  @override
  Future<PaymentIntent> getPaymentIntent(String id) => _api.getPaymentIntent(id);

  @override
  Future<PaymentIntent> createPaymentIntent({
    required String amountRequestedCrypto,
    required String currencyCrypto,
    required int expiresInMinutes,
  }) => _api.createPaymentIntent(
    amountRequestedCrypto: amountRequestedCrypto,
    currencyCrypto: currencyCrypto,
    expiresInMinutes: expiresInMinutes,
  );
}
