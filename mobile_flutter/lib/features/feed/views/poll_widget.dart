import 'package:flutter/material.dart';

class PollWidget extends StatefulWidget {
  final Map<String, dynamic> pollData;

  const PollWidget({
    super.key,
    required this.pollData,
  });

  @override
  State<PollWidget> createState() => _PollWidgetState();
}

class _PollWidgetState extends State<PollWidget> {
  String? _selectedOptionId;
  late Map<String, int> _optionVotes;
  late int _totalVotes;
  bool _hasVoted = false;

  @override
  void initState() {
    super.initState();
    _initPollData();
  }

  void _initPollData() {
    final optionsList = widget.pollData['options'] as List? ?? [];
    _optionVotes = {};
    int sumVotes = 0;

    for (var opt in optionsList) {
      if (opt is Map) {
        final id = opt['id']?.toString() ?? opt['text']?.toString() ?? '';
        final votes = (opt['votes'] as int?) ?? 0;
        _optionVotes[id] = votes;
        sumVotes += votes;
      } else if (opt is String) {
        _optionVotes[opt] = 0;
      }
    }

    _totalVotes = (widget.pollData['total_votes'] as int?) ?? sumVotes;
    _selectedOptionId = widget.pollData['user_voted_option']?.toString();
    _hasVoted = _selectedOptionId != null;
  }

  void _handleVote(String optionId) {
    if (_hasVoted) return;

    setState(() {
      _selectedOptionId = optionId;
      _hasVoted = true;
      _optionVotes[optionId] = (_optionVotes[optionId] ?? 0) + 1;
      _totalVotes += 1;
    });
  }

  @override
  Widget build(BuildContext context) {
    final question = widget.pollData['question']?.toString() ??
        widget.pollData['title']?.toString() ??
        'Опрос';
    final optionsList = widget.pollData['options'] as List? ?? [];

    return Container(
      margin: const EdgeInsets.symmetric(vertical: 8),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white.withOpacity(0.03),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(
          color: const Color(0xFF00C2FF).withOpacity(0.2),
          width: 1,
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Poll Header
          Row(
            children: [
              Container(
                padding: const EdgeInsets.all(8),
                decoration: BoxDecoration(
                  color: const Color(0xFF7000FF).withOpacity(0.2),
                  shape: BoxShape.circle,
                ),
                child: const Icon(
                  Icons.poll_rounded,
                  color: Color(0xFF00C2FF),
                  size: 20,
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Text(
                  question,
                  style: const TextStyle(
                    color: Colors.white,
                    fontWeight: FontWeight.bold,
                    fontSize: 15,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 14),

          // Options List
          ...optionsList.map((opt) {
            String optionId = '';
            String optionText = '';
            int votes = 0;

            if (opt is Map) {
              optionId = opt['id']?.toString() ?? opt['text']?.toString() ?? '';
              optionText = opt['text']?.toString() ?? opt['title']?.toString() ?? '';
              votes = _optionVotes[optionId] ?? (opt['votes'] as int? ?? 0);
            } else if (opt is String) {
              optionId = opt;
              optionText = opt;
              votes = _optionVotes[optionId] ?? 0;
            }

            final isSelected = _selectedOptionId == optionId;
            final percentage = _totalVotes > 0 ? (votes / _totalVotes) : 0.0;
            final percentText = '${(percentage * 100).round()}%';

            return Padding(
              padding: const EdgeInsets.only(bottom: 10.0),
              child: InkWell(
                onTap: () => _handleVote(optionId),
                borderRadius: BorderRadius.circular(14),
                child: Stack(
                  children: [
                    // Background Progress Fill (shown after voting)
                    if (_hasVoted)
                      Positioned.fill(
                        child: FractionallySizedBox(
                          alignment: Alignment.centerLeft,
                          widthFactor: percentage.clamp(0.02, 1.0),
                          child: AnimatedContainer(
                            duration: const Duration(milliseconds: 400),
                            decoration: BoxDecoration(
                              color: isSelected
                                  ? const Color(0xFF00C2FF).withOpacity(0.25)
                                  : Colors.white.withOpacity(0.06),
                              borderRadius: BorderRadius.circular(14),
                            ),
                          ),
                        ),
                      ),

                    // Option Tile Outline Container
                    Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 16,
                        vertical: 12,
                      ),
                      decoration: BoxDecoration(
                        borderRadius: BorderRadius.circular(14),
                        border: Border.all(
                          color: isSelected
                              ? const Color(0xFF00C2FF)
                              : Colors.white.withOpacity(0.08),
                          width: isSelected ? 1.5 : 1.0,
                        ),
                      ),
                      child: Row(
                        children: [
                          if (_hasVoted && isSelected)
                            const Padding(
                              padding: EdgeInsets.only(right: 8.0),
                              child: Icon(
                                Icons.check_circle_rounded,
                                color: Color(0xFF00C2FF),
                                size: 18,
                              ),
                            ),
                          Expanded(
                            child: Text(
                              optionText,
                              style: TextStyle(
                                color: isSelected ? Colors.white : Colors.white.withOpacity(0.87),
                                fontWeight:
                                    isSelected ? FontWeight.bold : FontWeight.normal,
                                fontSize: 14,
                              ),
                            ),
                          ),
                          if (_hasVoted)
                            Text(
                              percentText,
                              style: TextStyle(
                                color: isSelected
                                    ? const Color(0xFF00C2FF)
                                    : Colors.white38,
                                fontWeight: FontWeight.bold,
                                fontSize: 13,
                              ),
                            ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            );
          }),

          const SizedBox(height: 6),
          // Total Votes Footer
          Text(
            'Всего голосов: $_totalVotes',
            style: const TextStyle(
              color: Colors.white38,
              fontSize: 12,
              fontWeight: FontWeight.w500,
            ),
          ),
        ],
      ),
    );
  }
}
