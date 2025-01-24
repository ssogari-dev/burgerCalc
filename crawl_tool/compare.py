import pandas as pd

# 변수 설정
file_a = "hu.csv"  # A 파일 이름
file_b = "extracted_sig_data.csv"  # B 파일 이름

compare_col_a1 = "prov"  # A 파일에서 비교할 첫 번째 열 이름
compare_col_b1 = "prov"  # B 파일에서 비교할 첫 번째 열 이름
compare_col_a2 = "area"  # A 파일에서 비교할 두 번째 열 이름
compare_col_b2 = "SIG_KOR_NM"  # B 파일에서 비교할 두 번째 열 이름

source_col_b = "SIG_CD"  # B 파일에서 복사할 열 이름
target_col_a = "sig_cd"  # A 파일에서 데이터를 복사할 대상 열 이름

# CSV 파일 읽기
df_a = pd.read_csv(file_a)
df_b = pd.read_csv(file_b)

# 데이터 비교 및 값 복사
for index_a, row_a in df_a.iterrows():
    for _, row_b in df_b.iterrows():
        if (str(row_a[compare_col_a1]).replace(" ", "") == str(row_b[compare_col_b1]).replace(" ", "") and 
            str(row_a[compare_col_a2]).replace(" ", "") == str(row_b[compare_col_b2]).replace(" ", "")):
            df_a.at[index_a, target_col_a] = str(row_b[source_col_b])

# 결과 저장
df_a.to_csv(file_a, index=False, encoding="utf-8-sig")
print(f"Data copied successfully and saved to {file_a}")
