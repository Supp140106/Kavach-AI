path = "/home/cazz/Kavach-AI/backend/src/routes/auth.rs"
with open(path, "r") as f:
    content = f.read()

old = '''    let user = match repo
        .find_by_google_id(&claims.sub)
        .await
        .map_err(|_| err(StatusCode::INTERNAL_SERVER_ERROR, "Database error"))?
    {'''

new = '''    let user = match repo
        .find_by_google_id(&claims.sub)
        .await
        .map_err(|e| {
            tracing::error!("google_login: find_by_google_id failed: {e:?}");
            err(StatusCode::INTERNAL_SERVER_ERROR, "Database error")
        })?
    {'''

if old not in content:
    print("PATTERN NOT FOUND - no changes made")
else:
    content = content.replace(old, new, 1)
    with open(path, "w") as f:
        f.write(content)
    print("PATCHED SUCCESSFULLY")
