import os
import pandas as pd
import glob
from concurrent.futures import ThreadPoolExecutor

# 추출할 컬럼 리스트
COLUMNS_TO_KEEP = ['상호명', '도로명주소', '시도명', '시군구명', '행정동명']

# 필터링 조건에 맞는 데이터를 처리하는 함수
def process_csv(file_path):
    try:
        print(f"Processing file: {file_path}")  # 현재 처리 중인 파일 이름 출력
        # CSV 읽기 (low_memory=False로 경고 방지)
        df = pd.read_csv(file_path, encoding='utf-8', low_memory=False)

        # 필요한 컬럼만 추출
        df = df[COLUMNS_TO_KEEP]

        # 조건에 맞는 데이터 필터링
        filtered_df = df[df['상호명'].str.contains('이삭토스트', na=False)]

        return filtered_df
    except Exception as e:
        print(f"Error processing {file_path}: {e}")
        return pd.DataFrame(columns=COLUMNS_TO_KEEP)

# 폴더 내 모든 CSV 파일 처리
def process_all_csv(folder_path, output_file):
    # 폴더 내 모든 CSV 파일 찾기
    csv_files = glob.glob(os.path.join(folder_path, r"*.csv"))

    # 스레드 풀 생성
    with ThreadPoolExecutor() as executor:
        # 모든 CSV 파일을 병렬로 처리
        results = list(executor.map(process_csv, csv_files))

    # 결과 병합
    final_df = pd.concat(results, ignore_index=True)

    # 결과를 CSV로 저장
    final_df.to_csv(output_file, index=False, encoding='utf-8-sig')
    print(f"Filtered data saved to {output_file}")



# 사용 예시
folder_path = r".\소상공인시장진흥공단_상가(상권)정보_20240930"  # CSV 파일이 있는 폴더 경로
output_file = "issac.csv"  # 결과를 저장할 파일 경로
process_all_csv(folder_path, output_file)
