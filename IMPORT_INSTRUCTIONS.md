# GCP ACE Practice Test 1 - Anki Import Instructions

## Files Provided

✅ **gcp_ace_practice_test_1.csv** - Standard comma-separated format
✅ **gcp_ace_practice_test_1_semicolon.csv** - Semicolon-separated (better for Excel preview)

## Quick Stats

- **Total Questions**: 50
- **Single Choice Questions**: 48 (QType = 2)
- **Multiple Choice Questions**: 2 (QType = 1)
  - Question 12: Select TWO answers
  - All other questions have one correct answer

## Import Steps

### 1. Install the Required Anki Add-on

1. Open Anki Desktop
2. Go to **Tools** → **Add-ons** → **Get Add-ons**
3. Enter code: **1566095810**
4. Install **Multiple Choice for Anki**
5. Restart Anki

### 2. Import the CSV File

1. Click **File** → **Import**
2. Select `gcp_ace_practice_test_1.csv` (or the semicolon version if you prefer)
3. **CRITICAL**: Set the following options:

   **Field Mapping (11 columns):**
   ```
   Field 1  → Question
   Field 2  → QType
   Field 3  → Q_1 (Option A)
   Field 4  → Q_2 (Option B)
   Field 5  → Q_3 (Option C)
   Field 6  → Q_4 (Option D)
   Field 7  → Q_5 (Option E)
   Field 8  → Answers
   Field 9  → Sources
   Field 10 → Extra 1
   Field 11 → Tags
   ```

4. **Note Type**: Select **AllInOne (kprim, mc, sc)** from the Multiple Choice add-on
5. **Deck**: Choose your desired deck or create a new one (e.g., "GCP ACE - Practice Test 1")
6. **✅ IMPORTANT**: Check "Allow HTML in fields"
7. Click **Import**

### 3. Verify Import

After importing, check a few cards to ensure:
- Questions display correctly
- All 4-5 options are visible
- Explanations are formatted with green headers and bullet points
- Answer selection works properly

## Understanding the Format

### QType Values
- **2** = Single choice (one correct answer) - Most questions
- **1** = Multiple choice (two or more correct) - Question 12 only

### Answers Format
The Answers field uses binary format (5 digits separated by spaces):
- `1 0 0 0 0` = Option A is correct
- `0 1 0 0 0` = Option B is correct
- `0 0 1 0 0` = Option C is correct
- `0 0 0 1 0` = Option D is correct
- `1 0 0 1 0` = Options A and D are both correct (multiple choice)

### Explanation Format
Each explanation includes:
- ✅ **Green bold statement** explaining why the correct answer is right
- 📋 **Bulleted list** explaining why each wrong answer is incorrect

## Topics Covered

This practice test covers all four GCP ACE exam domains:

1. **Setting up a cloud solution environment** (Questions 1-5, 39-43)
   - IAM service accounts and roles
   - VPC creation and firewall rules
   - Startup scripts and metadata
   - Organization policies

2. **Planning and implementing a cloud solution** (Questions 7-24)
   - VM and GKE cluster creation (gcloud commands)
   - Storage classes and services
   - Networking (CIDR, firewall priorities)
   - Service selection (Dataproc, BigTable, Filestore, Marketplace)

3. **Ensuring successful operation** (Questions 6, 25-27, 37, 44-50)
   - GKE management (DaemonSet, ReplicaSet, StatefulSet)
   - Monitoring and troubleshooting
   - Cloud Run configuration
   - Database Center alerts
   - VPN troubleshooting

4. **Configure access and security** (Questions 28-36, 38)
   - IAM users, roles, and policies
   - Service accounts and JSON keys
   - Firewall rules and network tags
   - Metadata access
   - Google Groups best practices

## Study Tips

### For Command Syntax Questions
- Pay attention to the exact format: `gcloud [service] [resource] [action]`
- Watch for fake parameters that don't exist
- Remember: `gcloud` for most services, `gsutil` for storage ACLs

### For Service Selection Questions
- Consider: scalability, cost, managed vs. unmanaged
- Look for keywords: "managed", "predefined", "custom"
- Think about data access patterns (Standard, Nearline, Coldline)

### For Security Questions
- Principle of least privilege
- Service accounts > JSON keys
- Groups > individual users
- Firewall source filters: service accounts > network tags > IP addresses

## Troubleshooting Import Issues

**If columns don't align:**
- Try the semicolon version instead
- Verify you selected the correct note type (AllInOne)
- Ensure all 11 fields are mapped

**If explanations don't format:**
- Make sure "Allow HTML in fields" is checked
- Verify Extra 1 is mapped to the explanation field

**If answers aren't working:**
- Check that Answers field has exactly 5 digits with spaces
- Verify QType is either 1 or 2

## Additional Notes

- Question 12 is the only multiple-select question (TWO correct answers: B and D)
- All questions include detailed explanations of why wrong answers are incorrect
- Focus on understanding the reasoning patterns, not just memorizing answers
- These questions test real exam skills: command syntax, service selection, and best practices

---

**Created for**: Raymond's GCP ACE Exam Preparation
**Practice Test**: Test 1 of Multiple
**Format**: Multiple Choice for Anki (AllInOne note type)
**Date**: November 2025
