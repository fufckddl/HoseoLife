#!/usr/bin/env python3
"""
연속성 체크 로직 디버깅
"""

def check_continuous(periods):
    """연속성 체크 함수"""
    periods_sorted = sorted(periods)
    print(f"  정렬된 교시: {periods_sorted}")
    
    is_continuous = all(periods_sorted[i] + 1 == periods_sorted[i + 1] 
                      for i in range(len(periods_sorted) - 1))
    
    print(f"  연속성 체크:")
    for i in range(len(periods_sorted) - 1):
        current = periods_sorted[i]
        next_period = periods_sorted[i + 1]
        is_next = current + 1 == next_period
        print(f"    {current} -> {next_period}: {'연속' if is_next else '불연속'}")
    
    print(f"  최종 결과: {'연속' if is_continuous else '불연속'}")
    return is_continuous

def main():
    print("🔍 연속성 체크 디버깅")
    print("=" * 40)
    
    test_cases = [
        [3, 4],           # 연속
        [1, 2, 3],        # 연속
        [7, 8, 9, 10],    # 연속
        [2, 3, 10],       # 불연속 (2,3은 연속, 10은 떨어짐)
        [0, 1, 13],       # 불연속 (0,1은 연속, 13은 떨어짐)
        [1, 2, 10],       # 불연속 (1,2는 연속, 10은 떨어짐)
    ]
    
    for periods in test_cases:
        print(f"\n📝 교시: {periods}")
        is_continuous = check_continuous(periods)
        
        if is_continuous:
            print(f"  ✅ 연속 교시: {min(periods)}-{max(periods)}교시로 저장")
        else:
            print(f"  ⚠️  불연속 교시: {periods[0]}교시만 저장")

if __name__ == "__main__":
    main()
