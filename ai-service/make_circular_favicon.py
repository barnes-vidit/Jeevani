from PIL import Image, ImageDraw
import os

def make_circular(path, output_path):
    try:
        img = Image.open(path).convert("RGBA")
        
        # Create a circular mask
        mask = Image.new("L", img.size, 0)
        draw = ImageDraw.Draw(mask)
        draw.ellipse((0, 0) + img.size, fill=255)
        
        # Apply mask
        output = Image.new("RGBA", img.size, (0, 0, 0, 0))
        output.paste(img, (0, 0), mask=mask)
        
        output.save(output_path, "PNG")
        print(f"Successfully created circular icon at {output_path}")
    except Exception as e:
        print(f"Error processing image: {e}")

# Paths
base_dir = r"c:\Users\vidit shrama\Desktop\vidit"
source_path = os.path.join(base_dir, "client", "public", "favicon.png")
output_path = os.path.join(base_dir, "client", "public", "favicon.png") # Overwrite

make_circular(source_path, output_path)
