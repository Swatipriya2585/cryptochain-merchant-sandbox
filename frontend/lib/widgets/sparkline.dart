import 'package:flutter/material.dart';

class Sparkline extends StatelessWidget {
  const Sparkline({
    super.key,
    required this.values,
    this.color,
    this.height = 36,
  });

  final List<double> values;
  final Color? color;
  final double height;

  @override
  Widget build(BuildContext context) {
    final stroke = color ?? Theme.of(context).colorScheme.primary;
    return SizedBox(
      height: height,
      width: double.infinity,
      child: CustomPaint(
        painter: _SparkPainter(values: values, color: stroke),
      ),
    );
  }
}

class _SparkPainter extends CustomPainter {
  _SparkPainter({required this.values, required this.color});

  final List<double> values;
  final Color color;

  @override
  void paint(Canvas canvas, Size size) {
    if (values.isEmpty) return;
    final min = values.reduce((a, b) => a < b ? a : b);
    final max = values.reduce((a, b) => a > b ? a : b);
    final span = (max - min).abs() < 0.0001 ? 1.0 : max - min;
    final path = Path();
    for (var i = 0; i < values.length; i++) {
      final x = values.length == 1 ? 0.0 : size.width * i / (values.length - 1);
      final y = size.height - ((values[i] - min) / span) * size.height;
      if (i == 0) {
        path.moveTo(x, y);
      } else {
        path.lineTo(x, y);
      }
    }
    final paint = Paint()
      ..color = color
      ..strokeWidth = 2
      ..style = PaintingStyle.stroke
      ..strokeJoin = StrokeJoin.round
      ..strokeCap = StrokeCap.round;
    canvas.drawPath(path, paint);
  }

  @override
  bool shouldRepaint(covariant _SparkPainter oldDelegate) =>
      oldDelegate.values != values || oldDelegate.color != color;
}
