import os
import pandas as pd
import glob
from concurrent.futures import ThreadPoolExecutor

# 추출할 컬럼 리스트
COLUMNS_TO_KEEP = ['시도명', '시군구명']

# 지역 이름을 통일하는 함수
def replace_location_name(name):
    replacements = {
        "서울": ["서울특별시", "서울", "서울시"],
        "세종": ["세종특별자치시", "세종", "세종시"],
        "울산": ["울산광역시", "울산", "울산시"],
        "인천": ["인천광역시", "인천", "인천시"],
        "전남": ["전라남도", "전남"],
        "전북": ["전북특별자치도", "전라북도", "전북"],
        "제주": ["제주특별자치도", "제주", "제주시"],
        "충남": ["충청남도", "충남", "충남시"],
        "충북": ["충청북도", "충북"],
        "강원": ["강원특별자치도", "강원", "강원도", "강원시"],
        "경기": ["경기도", "경기"],
        "경남": ["경상남도", "경남"],
        "경북": ["경상북도", "경북"],
        "광주": ["광주광역시", "광주"],
        "대구": ["대구광역시", "대구", "대구광역", "대구시"],
        "대전": ["대전광역시", "대전", "대전시"],
        "부산": ["부산광역시", "부산", "부산시"]
    }

    for key, values in replacements.items():
        if name in values:
            return key
    return name

# 필터링 조건에 맞는 데이터를 처리하는 함수
def process_csv(file_path):
    try:
        print(f"Processing file: {file_path}")  # 현재 처리 중인 파일 이름 출력
        # CSV 읽기 (low_memory=False로 경고 방지)
        df = pd.read_csv(file_path, encoding='utf-8', low_memory=False)

        # 필요한 컬럼만 추출
        df = df[COLUMNS_TO_KEEP]

        # 시도명 통일화
        df['시도명'] = df['시도명'].apply(replace_location_name)

        # 중복 제거
        df = df.drop_duplicates()

        return df
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

    # 전체 데이터 중 중복 제거
    final_df = final_df.drop_duplicates()

    # 결과를 CSV로 저장
    final_df.to_csv(output_file, index=False, encoding='utf-8-sig')
    print(f"Filtered data saved to {output_file}")

# 사용 예시
folder_path = r".\소상공인시장진흥공단_상가(상권)정보_20240930"  # CSV 파일이 있는 폴더 경로
output_file = "unique_cities_normalized.csv"  # 결과를 저장할 파일 경로
process_all_csv(folder_path, output_file)
