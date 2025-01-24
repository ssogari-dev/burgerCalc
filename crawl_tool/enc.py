import pandas as pd

# CSV 파일을 불러오기
input_file = 'hu.csv'  # 불러올 CSV 파일 경로
output_file = 'hu-utf8.csv'  # 저장할 CSV 파일 경로

# CSV 파일을 pandas DataFrame으로 불러오기
df = pd.read_csv(input_file)

# DataFrame을 utf-8-sig 인코딩으로 저장하기
df.to_csv(output_file, index=False, encoding='utf-8-sig')

print(f"파일이 {output_file}로 저장되었습니다.")
