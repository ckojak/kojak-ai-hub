// Trecho corrigido da função handleSubmit
const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // Botão só envia se houver texto OU imagem anexada OU imagem de referência
    if ((!message.trim() && !attachedImage && !referenceImage) || isLoading || isUploading) return;

    let imageUrl: string | undefined;

    if (attachedImage) {
      setIsUploading(true);
      const uploadedUrl = await uploadImage(attachedImage);
      setIsUploading(false);
      if (!uploadedUrl) return;
      imageUrl = uploadedUrl;
    }

    // Payload profissional
    onSend(message.trim(), activeMode, imageUrl);
    setMessage("");
    removeImage();
};
