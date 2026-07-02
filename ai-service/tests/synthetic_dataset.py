"""
Synthetic Practical Dataset for Biography Generation Testing.
This module defines a representative memory corpus for a mock persona 'Arthur Pendelton'.
It is designed to verify era inference, character tracking, theme tracking, photo embedding, and quality gates.
"""

from typing import List, Dict, Any

SYNTHETIC_CORPUS: List[Dict[str, Any]] = [
    {
        "id": "mem_01",
        "era": "recent",
        "date": "2026-06-01T10:00:00",
        "source_type": "image",
        "original_name": "childhood_sandbox.jpg",
        "text": "Arthur playing with sister Sarah in the backyard sandbox in Seattle. He was about 7 years old and had a favorite toy shovel.",
        "summary": "Photo of Arthur and his sister Sarah playing in a sandbox during childhood.",
        "image_url": "https://res.cloudinary.com/demo/image/upload/v1/childhood_sandbox.jpg"
    },
    {
        "id": "mem_02",
        "era": "recent",
        "date": "2026-06-05T12:00:00",
        "source_type": "document",
        "original_name": "Seattle_High_School_Diploma.pdf",
        "text": "Seattle Central High School. This certifies that Arthur Pendelton has successfully completed the Course of Study and is hereby graduated on June 10, 1966.",
        "summary": "Arthur's High School Diploma from Seattle Central High School, dated June 1966.",
        "image_url": ""
    },
    {
        "id": "mem_03",
        "era": "recent",
        "date": "2026-06-10T09:30:00",
        "source_type": "document",
        "original_name": "UW_Graduation_Diploma.pdf",
        "text": "The Trustees of the University of Washington. Be it known that Arthur Pendelton, having completed the prescribed studies, is awarded the degree of Bachelor of Arts in History on June 15, 1970.",
        "summary": "University of Washington Bachelor of Arts in History diploma for Arthur Pendelton, dated June 1970.",
        "image_url": ""
    },
    {
        "id": "mem_04",
        "era": "recent",
        "date": "2026-06-12T18:00:00",
        "source_type": "journal",
        "original_name": "Journal entry March 1969",
        "text": "Met Clara at the university library today in March 1969. She was studying botany and had a green notebook. We talked about star constellations and astronomy for hours. I think she is wonderful.",
        "summary": "Journal entry reflecting on meeting Clara in the library in March 1969.",
        "image_url": ""
    },
    {
        "id": "mem_05",
        "era": "recent",
        "date": "2026-06-15T14:00:00",
        "source_type": "journal",
        "original_name": "Journal entry August 1972",
        "text": "Today, Clara and I got married at Golden Gardens Park in Seattle. The weather was perfect, sunny and breezy. My sister Sarah was the maid of honor. Clara looked stunning. August 15, 1972.",
        "summary": "Journal entry about marrying Clara at Golden Gardens Park on August 15, 1972.",
        "image_url": ""
    },
    {
        "id": "mem_06",
        "era": "recent",
        "date": "2026-06-16T11:00:00",
        "source_type": "document",
        "original_name": "Garfield_HS_Employment_Contract.pdf",
        "text": "Garfield High School Board of Education. Employment contract for Arthur Pendelton to serve as History Teacher. Salary: $8,500 per annum. Effective date: September 1, 1972.",
        "summary": "Garfield High School employment contract for Arthur Pendelton, starting September 1, 1972.",
        "image_url": ""
    },
    {
        "id": "mem_07",
        "era": "recent",
        "date": "2026-06-20T17:00:00",
        "source_type": "journal",
        "original_name": "Journal entry August 1985",
        "text": "Finished building the backyard observatory telescope mount today in August 1985. It took three weekends of welding and concrete pouring. Clara helped align the polar axis. Now I can track the rings of Saturn and distant nebulae. A dream come true.",
        "summary": "Journal entry recording the completion of the backyard observatory telescope mount in August 1985.",
        "image_url": ""
    },
    {
        "id": "mem_08",
        "era": "recent",
        "date": "2026-06-25T15:00:00",
        "source_type": "document",
        "original_name": "Garfield_HS_Retirement_Notice.pdf",
        "text": "Garfield High School Administration. Recognition of Service: Arthur Pendelton is retiring from active service in June 2014 after 42 years of teaching high school history. We thank him for his dedication and leadership of the astronomy club.",
        "summary": "Official retirement notice for Arthur Pendelton from Garfield High School in June 2014.",
        "image_url": ""
    },
    {
        "id": "mem_09",
        "era": "recent",
        "date": "2026-06-28T21:00:00",
        "source_type": "journal",
        "original_name": "Journal entry June 2026 reflections",
        "text": "Thinking back to my teaching years. I think I retired in 2012, or maybe it was 2013? Actually, it felt like ages ago. My teaching career was long, but it ended in the early 2010s. I miss the students, but retirement is peaceful.",
        "summary": "Reflecting on teaching and retirement years, noting a memory of retiring in 2012 or 2013.",
        "image_url": ""
    },
    {
        "id": "mem_10",
        "era": "recent",
        "date": "2026-06-30T22:30:00",
        "source_type": "journal",
        "original_name": "Journal entry June 2026 stars",
        "text": "Sitting in my backyard observatory tonight. The sky is incredibly clear for a June evening. Clara brought me hot chamomile tea. My hands are shaky when holding the focus knob, but the stars are as steady and magnificent as ever. Life has been good to us.",
        "summary": "Journal entry reflecting on looking at the stars from the backyard observatory in June 2026 with Clara.",
        "image_url": ""
    }
]


def get_synthetic_corpus() -> List[Dict[str, Any]]:
    """Returns the synthetic memory corpus for testing."""
    return SYNTHETIC_CORPUS
