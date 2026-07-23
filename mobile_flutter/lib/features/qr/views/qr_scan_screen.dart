import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';
import 'package:mobile_scanner/mobile_scanner.dart';
import '../../../core/network/api_client.dart';

class QRScanScreen extends StatefulWidget {
  const QRScanScreen({super.key});

  @override
  State<QRScanScreen> createState() => _QRScanScreenState();
}

class _QRScanScreenState extends State<QRScanScreen> {
  final MobileScannerController _controller = MobileScannerController();
  bool _isProcessing = false;

  Future<void> _handleQRScan(String qrToken) async {
    if (_isProcessing) return;
    setState(() {
      _isProcessing = true;
    });

    try {
      final apiClient = context.read<ApiClient>();
      final response = await apiClient.post<Map<String, dynamic>>(
        '/auth/qr/scan',
        data: {'qr_token': qrToken},
      );

      final data = response.data;
      if (mounted) {
        if (data != null && (data['success'] == true || data['ok'] == true)) {
          _showDialog('Успех', 'Вход на сайте выполнен!', true);
        } else {
          _showDialog('Ошибка', data?['error']?.toString() ?? 'Не удалось выполнить вход на сайте', false);
        }
      }
    } catch (e) {
      if (mounted) {
        _showDialog('Ошибка', 'Ошибка соединения с сервером: $e', false);
      }
    }
  }

  void _showDialog(String title, String message, bool isSuccess) {
    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (context) => AlertDialog(
        backgroundColor: const Color(0xFF13131A),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: Row(
          children: [
            Icon(
              isSuccess ? Icons.check_circle_outline : Icons.error_outline,
              color: isSuccess ? const Color(0xFF00FF87) : Colors.redAccent,
            ),
            const SizedBox(width: 8),
            Text(title, style: const TextStyle(color: Colors.white)),
          ],
        ),
        content: Text(message, style: const TextStyle(color: Colors.white70)),
        actions: [
          TextButton(
            onPressed: () {
              Navigator.pop(context);
              if (isSuccess) {
                context.pop(); // Go back to previous screen
              } else {
                setState(() {
                  _isProcessing = false;
                });
              }
            },
            child: const Text('OK', style: TextStyle(color: Color(0xFF00C2FF))),
          ),
        ],
      ),
    );
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.black,
      appBar: AppBar(
        backgroundColor: const Color(0xFF11111A),
        title: const Text('Вход по QR-коду', style: TextStyle(fontWeight: FontWeight.bold)),
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios_new, size: 20),
          onPressed: () => context.pop(),
        ),
      ),
      body: Stack(
        children: [
          // 1. Scanner Camera
          MobileScanner(
            controller: _controller,
            onDetect: (capture) {
              final barcodes = capture.barcodes;
              if (barcodes.isNotEmpty) {
                final value = barcodes.first.rawValue;
                if (value != null && !_isProcessing) {
                  _handleQRScan(value);
                }
              }
            },
          ),

          // 2. Custom HUD Overlay & Visual Styling
          Positioned.fill(
            child: Container(
              decoration: ShapeDecoration(
                shape: QrScannerOverlayShape(
                  borderColor: const Color(0xFF00C2FF),
                  borderRadius: 24,
                  borderLength: 30,
                  borderWidth: 6,
                  cutOutSize: MediaQuery.of(context).size.width * 0.7,
                ),
              ),
            ),
          ),

          // 3. Status/Instruction text
          Positioned(
            bottom: 80,
            left: 20,
            right: 20,
            child: Container(
              padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 24),
              decoration: BoxDecoration(
                color: Colors.black.withOpacity(0.6),
                borderRadius: BorderRadius.circular(20),
                border: Border.all(color: Colors.white.withOpacity(0.08)),
              ),
              child: Center(
                child: Text(
                  _isProcessing ? 'Авторизация...' : 'Наведите камеру на QR-код на сайте vondic.ru',
                  textAlign: TextAlign.center,
                  style: const TextStyle(
                    color: Colors.white,
                    fontWeight: FontWeight.w500,
                    fontSize: 14,
                  ),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

// Custom painter overlay for standard scanner frame look
class QrScannerOverlayShape extends ShapeBorder {
  final Color borderColor;
  final double borderWidth;
  final double borderLength;
  final double borderRadius;
  final double cutOutSize;

  const QrScannerOverlayShape({
    this.borderColor = Colors.white,
    this.borderWidth = 4.0,
    this.borderLength = 20.0,
    this.borderRadius = 12.0,
    this.cutOutSize = 250.0,
  });

  @override
  EdgeInsetsGeometry get dimensions => EdgeInsets.zero;

  @override
  Path getInnerPath(Rect rect, {TextDirection? textDirection}) => Path();

  @override
  Path getOuterPath(Rect rect, {TextDirection? textDirection}) {
    return Path()..addRect(rect);
  }

  @override
  void paint(Canvas canvas, Rect rect, {TextDirection? textDirection}) {
    final width = rect.width;
    final height = rect.height;

    final paint = Paint()
      ..color = Colors.black.withOpacity(0.65)
      ..style = PaintingStyle.fill;

    final boxRect = Rect.fromCenter(
      center: Offset(width / 2, height / 2),
      width: cutOutSize,
      height: cutOutSize,
    );

    // Paint background surrounding scanner window
    canvas.drawPath(
      Path.combine(
        PathOperation.difference,
        Path()..addRect(rect),
        Path()..addRRect(RRect.fromRectAndRadius(boxRect, Radius.circular(borderRadius))),
      ),
      paint,
    );

    final borderPaint = Paint()
      ..color = borderColor
      ..style = PaintingStyle.stroke
      ..strokeWidth = borderWidth
      ..strokeCap = StrokeCap.round;

    final rrect = RRect.fromRectAndRadius(boxRect, Radius.circular(borderRadius));

    // Paint corners
    // Top Left
    canvas.drawPath(
      Path()
        ..moveTo(rrect.left, rrect.top + borderLength)
        ..lineTo(rrect.left, rrect.top + borderRadius)
        ..arcToPoint(Offset(rrect.left + borderRadius, rrect.top), radius: Radius.circular(borderRadius))
        ..lineTo(rrect.left + borderLength, rrect.top),
      borderPaint,
    );

    // Top Right
    canvas.drawPath(
      Path()
        ..moveTo(rrect.right - borderLength, rrect.top)
        ..lineTo(rrect.right - borderRadius, rrect.top)
        ..arcToPoint(Offset(rrect.right, rrect.top + borderRadius), radius: Radius.circular(borderRadius))
        ..lineTo(rrect.right, rrect.top + borderLength),
      borderPaint,
    );

    // Bottom Left
    canvas.drawPath(
      Path()
        ..moveTo(rrect.left, rrect.bottom - borderLength)
        ..lineTo(rrect.left, rrect.bottom - borderRadius)
        ..arcToPoint(Offset(rrect.left + borderRadius, rrect.bottom), radius: Radius.circular(borderRadius))
        ..lineTo(rrect.left + borderLength, rrect.bottom),
      borderPaint,
    );

    // Bottom Right
    canvas.drawPath(
      Path()
        ..moveTo(rrect.right - borderLength, rrect.bottom)
        ..lineTo(rrect.right - borderRadius, rrect.bottom)
        ..arcToPoint(Offset(rrect.right, rrect.bottom - borderRadius), radius: Radius.circular(borderRadius))
        ..lineTo(rrect.right, rrect.bottom - borderLength),
      borderPaint,
    );
  }

  @override
  ShapeBorder scale(double t) => this;
}
