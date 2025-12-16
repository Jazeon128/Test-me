# Performance Benchmarks

This directory contains performance benchmarks for the Test Me platform using pytest-benchmark.

## Running Benchmarks

### Run all benchmarks
```bash
pytest tests/benchmarks/ --benchmark-only
```

### Run specific benchmark group
```bash
pytest tests/benchmarks/test_performance_benchmarks.py::TestQuestionGenerationBenchmarks --benchmark-only
```

### Save benchmark results
```bash
pytest tests/benchmarks/ --benchmark-only --benchmark-save=baseline
```

### Compare against baseline
```bash
pytest tests/benchmarks/ --benchmark-only --benchmark-compare=baseline
```

### Generate HTML report
```bash
pytest tests/benchmarks/ --benchmark-only --benchmark-histogram
```

## Benchmark Categories

### Question Generation Benchmarks
- `test_benchmark_question_generation_10_questions`: Measures time to generate 10 questions
- `test_benchmark_section_selection`: Measures section selection algorithm performance
- `test_benchmark_response_parsing`: Measures AI response parsing speed

### Database Benchmarks
- `test_benchmark_question_query`: Measures question query performance
- `test_benchmark_question_with_options_query`: Measures query with eager loading
- `test_benchmark_bulk_question_insert`: Measures bulk insert performance

### API Benchmarks
- `test_benchmark_get_question_endpoint`: Measures GET /api/questions/{id} response time
- `test_benchmark_list_decks_endpoint`: Measures GET /api/decks response time
- `test_benchmark_get_documents_endpoint`: Measures GET /api/documents response time

### Parsing Benchmarks
- `test_benchmark_text_cleaning`: Measures text cleaning operation speed
- `test_benchmark_section_creation`: Measures ParsedSection object creation

## Performance Targets

Based on requirements 8.1-8.5:

- **Question Generation**: Should complete within (S / 1000) * 5 + 10 seconds for section size S
- **API Response Time**: < 2 seconds for 95% of requests
- **Database Queries**: < 100ms for 95% of queries
- **Memory Usage**: < 5x document file size during parsing

## Regression Detection

To detect performance regressions:

1. Establish baseline on main branch:
   ```bash
   pytest tests/benchmarks/ --benchmark-only --benchmark-save=main
   ```

2. Run benchmarks on feature branch:
   ```bash
   pytest tests/benchmarks/ --benchmark-only --benchmark-compare=main
   ```

3. Review comparison output for significant slowdowns (>10% regression)

## CI Integration

Add to CI pipeline:
```yaml
- name: Run Performance Benchmarks
  run: |
    pytest tests/benchmarks/ --benchmark-only --benchmark-json=benchmark.json
    
- name: Store Benchmark Results
  uses: benchmark-action/github-action-benchmark@v1
  with:
    tool: 'pytest'
    output-file-path: benchmark.json
```

## Interpreting Results

Benchmark output includes:
- **Min/Max**: Fastest and slowest execution times
- **Mean**: Average execution time
- **StdDev**: Standard deviation (consistency indicator)
- **Median**: Middle value (less affected by outliers)
- **IQR**: Interquartile range (spread of middle 50%)
- **Outliers**: Number of outlier measurements
- **OPS**: Operations per second (higher is better)

Look for:
- High standard deviation → inconsistent performance
- Many outliers → external factors affecting tests
- Significant mean increase → potential regression
