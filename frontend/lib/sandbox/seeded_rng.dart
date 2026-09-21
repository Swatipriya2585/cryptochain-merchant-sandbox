/// Deterministic LCG so sandbox figures stay stable for a session seed.
class SeededRandom {
  SeededRandom(int seed) : _state = seed & 0x7fffffff;

  int _state;

  int nextInt(int max) {
    if (max <= 0) {
      throw ArgumentError.value(max, 'max');
    }
    _state = (_state * 1103515245 + 12345) & 0x7fffffff;
    return _state % max;
  }

  double nextDouble() => nextInt(1 << 24) / (1 << 24);

  double range(double min, double max) => min + nextDouble() * (max - min);

  T pick<T>(List<T> items) => items[nextInt(items.length)];

  String hex(int length) {
    const chars = '0123456789abcdef';
    return List.generate(length, (_) => chars[nextInt(chars.length)]).join();
  }
}
