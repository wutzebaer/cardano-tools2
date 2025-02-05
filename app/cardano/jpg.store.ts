export async function getCollectionInfo(policyId: string) {
  try {
    const response = await fetch(`https://server.jpgstoreapis.com/collection/${policyId}`, {
      headers: {
        "X-jpgstore-csrf-protection": "1",
      },
    });
    if (!response.ok && !(response.status === 404)) {
      throw new Error(`Server error: ${response.status} ${response.statusText}`);
    }
    return (await response.json()).collection ?? {};
  } catch (error) {
    console.error("Failed to fetch collection info:", error);
    throw error;
  }
}
