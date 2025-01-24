import os
import csv

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

def load_sample_areas(sample_file_path):
    areas = set()
    with open(sample_file_path, mode='r', encoding='utf-8-sig') as file:
        reader = csv.DictReader(file)
        for row in reader:
            areas.add(row['시군구명'])
    return areas

def process_csv(file_path, sample_areas, fail_writer):
    directory, filename = os.path.split(file_path)
    output_directory = os.path.join(directory, "filter")
    os.makedirs(output_directory, exist_ok=True)
    output_file_path = os.path.join(output_directory, filename)

    processed_data = []
    processed_data.append(["store", "addr", "prov", "area", "div"])

    with open(file_path, mode='r', encoding='utf-8-sig') as input_file:
        reader = csv.reader(input_file)
        
        # Check if the file is empty or only contains a header
        try:
            headers = next(reader)  # Attempt to read the header
        except StopIteration:
            print(f"No data in file {filename}, skipping...")
            return
        
        for row in reader:
            store, addr = row[0], row[1]
            addr_words = addr.split()

            prov = replace_location_name(addr_words[0]) if addr_words else ""
            area = addr_words[1] if len(addr_words) > 1 else ""
            
            if prov == "세종":
                area = "세종시"
            elif len(addr_words) > 2 and addr_words[2].endswith("구"):
                area += f" {addr_words[2]}"
                
            div = f"{prov} {area}".strip()

            if area in sample_areas:
                processed_data.append([store, addr, prov, area, div])
            else:
                fail_writer.writerow([store, addr, prov, area, div, filename])

    with open(output_file_path, mode='w', encoding='utf-8-sig', newline='') as output_file:
        writer = csv.writer(output_file)
        writer.writerows(processed_data)

    print(f"Processed file saved at: {output_file_path}")

def process_all_csv_in_directory(sample_file_path):
    sample_areas = load_sample_areas(sample_file_path)
    current_directory = os.getcwd()
    fail_file_path = os.path.join(current_directory, 'fail.csv')

    with open(fail_file_path, mode='w', encoding='utf-8-sig', newline='') as fail_file:
        fail_writer = csv.writer(fail_file)
        fail_writer.writerow(["store", "addr", "prov", "area", "div", "original_file"])

        csv_files = [f for f in os.listdir(current_directory) if f.endswith('.csv') and f != 'sample.csv']
        for csv_file in csv_files:
            file_path = os.path.join(current_directory, csv_file)
            process_csv(file_path, sample_areas, fail_writer)

if __name__ == "__main__":
    sample_file_path = 'sample.csv'
    process_all_csv_in_directory(sample_file_path)