import os
import json

def scan_folder(folder_path):
    result = {
        "name": os.path.basename(folder_path),
        "type": "directory",
        "path": folder_path,
        "contents": []
    }
    
    try:
        for item in os.listdir(folder_path):
            item_path = os.path.join(folder_path, item)
            if os.path.isdir(item_path):
                # Recursively scan subdirectories
                result["contents"].append(scan_folder(item_path))
            else:
                # Add file information
                result["contents"].append({
                    "name": item,
                    "type": "file",
                    "path": item_path
                })
    except PermissionError:
        print(f"Permission denied accessing {folder_path}")
    except Exception as e:
        print(f"Error scanning {folder_path}: {str(e)}")
    
    return result

def save_to_json(folder_data, output_file):
    try:
        with open(output_file, 'w', encoding='utf-8') as f:
            json.dump(folder_data, f, indent=4, ensure_ascii=False)
        print(f"Folder structure saved to {output_file}")
    except Exception as e:
        print(f"Error saving JSON file: {str(e)}")

def main():
    folder_path = input("Enter the folder path to scan: ")
    output_file = "folder_structure.json"
    
    if not os.path.exists(folder_path):
        print("The specified folder does not exist!")
        return
    
    folder_data = scan_folder(folder_path)
    save_to_json(folder_data, output_file)

if __name__ == "__main__":
    main()